import assert from "node:assert/strict";
import test from "node:test";

import { chromium, webkit } from "playwright";

import { startStaticRepoServer } from "./helpers/desktop_harness_browser.mjs";
import { loadUIModule } from "./helpers/load_ui_module.mjs";
import {
    createCurrentSpeedrunContext,
    loadSpeedrunModules,
    repoRoot,
} from "./helpers/speedrun_test_context.mjs";

let fixture;
let server;

function packMidi(status, note, velocity) {
    return ((status & 0xff) << 16) | ((note & 0x7f) << 8) | (velocity & 0x7f);
}

function timedSection(index) {
    const startFrame = index * 60;
    return {
        section: {
            id: `sound-share-audio-${index}`,
            kind: "oscillator",
            label: `Sound share audio ${index}`,
            captions: [],
            uncappedCaptions: [],
            ops: [],
            opCaptionLines: [],
        },
        startFrame,
        endFrame: startFrame + 60,
        startSample: startFrame * 1_600,
        endSample: (startFrame + 60) * 1_600,
        captionEvents: [],
        opSpans: [],
        checkpointIndex: index,
    };
}

function timeline() {
    return {
        fps: 30,
        sampleRate: 48_000,
        samplesPerFrame: 1_600,
        durationInFrames: 120,
        compressionLevel: 0,
        sections: [timedSection(0), timedSection(1)],
    };
}

function renderState(document) {
    return {
        parameters: document.parameters,
        modulation: document.modulation,
        lane: document.lane,
        articulations: document.articulations,
    };
}

async function buildFixture() {
    const [context, modules, maximalModule, envelopeModule, shareModule] = await Promise.all([
        createCurrentSpeedrunContext(),
        loadSpeedrunModules(),
        loadUIModule(repoRoot, "tests/fixtures/sound-share-maximal.ts"),
        loadUIModule(repoRoot, "ui/shared/sound-share-envelope.ts"),
        loadUIModule(repoRoot, "ui/shared/sound-share-link.ts"),
    ]);
    const maximal = maximalModule.createMaximalSoundFixture(context.inputEndpoints);
    const preset = {
        kind: "cosimo.effectPreset",
        version: 2,
        effectID: context.options.currentContract.effectID,
        presetID: "cosimo.share.audio-proof",
        label: maximal.label,
        contract: context.options.currentContract,
        parameters: maximal.parameters,
        storedState: {
            "modulation.v6": maximal.storedState["modulation.v6"],
            "articulations.v4": maximal.storedState["articulations.v4"],
            "bounce.v1": null,
        },
    };
    const envelope = envelopeModule.createSoundShareEnvelope({
        preset,
        supplementalStoredState: { "lane.v1": maximal.storedState["lane.v1"] },
    });
    const rawBytes = Buffer.byteLength(JSON.stringify(envelope));
    assert.equal(rawBytes, 3_110_089);
    const created = await shareModule.createSoundShareURL(envelope, "https://cosimo.test/");
    assert.equal(created.ok, true, created.ok ? undefined : created.error.message);
    const decoded = await shareModule.decodeSoundShareFragment(new URL(created.value.url).hash);
    assert.equal(decoded.ok, true, decoded.ok ? undefined : decoded.error.message);
    const source = modules.patchIO.intakePatch(envelope, context.options);
    const restored = modules.patchIO.intakePatch(decoded.value, context.options);
    assert.equal(source.ok, true, source.ok ? undefined : source.error.message);
    assert.equal(restored.ok, true, restored.ok ? undefined : restored.error.message);
    assert.deepEqual(restored.value.document, source.value.document);
    assert.equal(Object.keys(source.value.document.parameters).length, maximal.facts.parameterCount);
    assert.equal(source.value.document.modulation.routes.length, maximal.facts.modulationRouteCount);
    assert.equal(source.value.document.articulations.slots.length, maximal.facts.articulationSlotCount);
    assert.equal(Object.keys(source.value.document.lane.devices).length, maximal.facts.laneDeviceCount);

    return {
        envelope,
        rawBytes,
        renderRequest: {
            states: [renderState(source.value.document), renderState(restored.value.document)],
            timeline: timeline(),
            performance: {
                durationSec: 1,
                events: [
                    { atSec: 0, code: packMidi(0x90, 60, 100) },
                    { atSec: 0.4, code: packMidi(0x80, 60, 0) },
                ],
            },
            concurrency: 2,
            maxInstallFrames: 192_000,
        },
    };
}

async function openHarness(browserType) {
    const browser = await browserType.launch({ headless: true });
    const page = await browser.newPage();
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
    test(`${browserName}: maximal source and restored link render identical audible PCM`, {
        timeout: 240_000,
    }, async () => {
        const { browser, page } = await openHarness(browserType);
        try {
            const shared = await page.evaluate((envelope) => (
                window.__COSIMO_SPEEDRUN_AUDIO_HARNESS__.measureSoundShareURL(envelope)
            ), fixture.envelope);
            assert.equal(shared.ok, true, shared.ok ? undefined : shared.message);
            assert.equal(shared.lengthClass, "warning");
            assert.equal(shared.length, browserName === "Chromium" ? 71_656 : 118_164);

            const rendered = await page.evaluate((request) => (
                window.__COSIMO_SPEEDRUN_AUDIO_HARNESS__.render(request)
            ), fixture.renderRequest);
            assert.equal(rendered.checkpoints.length, 2);
            const [source, restored] = rendered.checkpoints;
            assert.ok(source.rms > 1e-5, `${browserName} maximal source rendered silence`);
            assert.equal(restored.digest, source.digest);
            assert.equal(restored.rms, source.rms);
            assert.equal(restored.peak, source.peak);
            assert.equal(restored.tailRms, source.tailRms);
            assert.equal(restored.spectralCentroid, source.spectralCentroid);
            assert.ok(rendered.checkpoints.every((checkpoint) => checkpoint.telemetry.populatedFrameCount > 0));
        } finally {
            await browser.close();
        }
    });
}
