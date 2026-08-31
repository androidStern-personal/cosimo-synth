import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the production graph gates one shared analyzer and response endpoint from the view lease", async () => {
    const source = await readFile(path.join(repoRoot, "cmajor/WavetableSynth.cmajor"), "utf8");

    assert.match(source, /input event int32 voiceEnhancerSpectrumActivity;/);
    assert.doesNotMatch(
        source,
        /voiceEnhancerSpectrumActivity\s*\[\[/,
        "the view lease must not become a named host parameter",
    );
    assert.match(
        source,
        /output event \(wt::EnhancerSpectrumFrame, wt::VoiceEnhancerResponseFrame\) voiceEnhancerSpectrum;/,
    );
    assert.match(source, /node voiceEnhancerInputSpectrum = wt::EnhancerSpectrumAnalyzer \(0\);/);
    assert.match(
        source,
        /voiceEnhancerSpectrumActivity -> sharedEngine\.voiceEnhancerVisualizationEnabledIn,\s*voiceEnhancerInputSpectrum\.enabledIn;/,
    );
    assert.match(
        source,
        /sharedEngine\.voiceEnhancerInputMonitor -> voiceEnhancerInputSpectrum\.in;/,
    );
    assert.match(
        source,
        /sharedEngine\.voiceEnhancerResponseOut -> voiceEnhancerSpectrum;/,
    );
    assert.match(
        source,
        /voiceEnhancerInputSpectrum\.spectrum -> voiceEnhancerSpectrum;/,
    );
});

test("per-voice Enhancer telemetry folds spectrum and active responses without stale curves", async () => {
    const telemetry = await loadUIModule(repoRoot, "ui/shared/voice-enhancer.ts");
    let state = telemetry.createVoiceEnhancerTelemetryDisplay();

    assert.equal(telemetry.VOICE_ENHANCER_SPECTRUM_ENDPOINT_ID, "voiceEnhancerSpectrum");
    assert.deepEqual(state, { spectrum: null, responses: [] });

    state = telemetry.advanceVoiceEnhancerTelemetryDisplay(state, {
        event: {
            responseCount: 2,
            voiceIndices: [0, 3, 0, 0],
            frequenciesHz: [261.6256, 523.2511, 0, 0],
            qValues: [0.71, 2.5, 0, 0],
            amounts: [0.4, 0.8, 0, 0],
        },
    }, 10);
    assert.deepEqual(state.responses, [
        { voiceIndex: 0, frequencyHz: 261.6256, q: 0.71, amount: 0.4 },
        { voiceIndex: 3, frequencyHz: 523.2511, q: 2.5, amount: 0.8 },
    ]);
    assert.equal(state.spectrum, null);

    state = telemetry.advanceVoiceEnhancerTelemetryDisplay(state, {
        responseCount: 1,
        voiceIndices: [7],
        frequenciesHz: [21_600],
        qValues: [1],
        amounts: [0.5],
    }, 15);
    assert.deepEqual(
        state.responses,
        [{ voiceIndex: 7, frequencyHz: 21_600, q: 1, amount: 0.5 }],
        "sample-rate-clamped Key Track centers beyond 20 kHz remain DSP-owned telemetry",
    );

    const magnitudes = new Array(2_048).fill(0);
    magnitudes[200] = 1;
    state = telemetry.advanceVoiceEnhancerTelemetryDisplay(state, {
        sampleRateHz: 4_096,
        magnitudes,
    }, 20);
    assert.ok(state.spectrum);
    assert.deepEqual(state.responses.map(({ voiceIndex }) => voiceIndex), [7]);

    const retainedSpectrum = state.spectrum;
    state = telemetry.advanceVoiceEnhancerTelemetryDisplay(state, {
        responseCount: 0,
        voiceIndices: [],
        frequenciesHz: [],
        qValues: [],
        amounts: [],
    }, 30);
    assert.deepEqual(state.responses, []);
    assert.equal(state.spectrum, retainedSpectrum);
});

test("per-voice Enhancer telemetry rejects malformed response frames and null resets the seam", async () => {
    const telemetry = await loadUIModule(repoRoot, "ui/shared/voice-enhancer.ts");
    const valid = telemetry.advanceVoiceEnhancerTelemetryDisplay(
        telemetry.createVoiceEnhancerTelemetryDisplay(),
        {
            responseCount: 1,
            voiceIndices: [2],
            frequenciesHz: [440],
            qValues: [1.25],
            amounts: [0.5],
        },
        10,
    );

    for (const malformed of [
        { responseCount: 17, voiceIndices: [], frequenciesHz: [], qValues: [], amounts: [] },
        { responseCount: 1, voiceIndices: [2], frequenciesHz: [Number.NaN], qValues: [1], amounts: [0.5] },
        { responseCount: 1, voiceIndices: [2], frequenciesHz: [440], qValues: [], amounts: [0.5] },
        { responseCount: 1, voiceIndices: [2.5], frequenciesHz: [440], qValues: [1], amounts: [0.5] },
    ]) {
        assert.equal(
            telemetry.advanceVoiceEnhancerTelemetryDisplay(valid, malformed, 20),
            valid,
        );
    }

    assert.deepEqual(
        telemetry.advanceVoiceEnhancerTelemetryDisplay(valid, null, 30),
        telemetry.createVoiceEnhancerTelemetryDisplay(),
    );
});
