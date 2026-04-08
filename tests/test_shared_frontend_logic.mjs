import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadRuntimeTableStateModule() {
    return await loadUIModule(repoRoot, "ui/shared/runtime-table-state.ts");
}

async function loadDisplayGestureModule() {
    return await loadUIModule(repoRoot, "ui/shared/display-gesture.ts");
}

async function loadKeyboardGeometryModule() {
    return await loadUIModule(repoRoot, "ui/shared/keyboard-geometry.ts");
}

async function loadFilterResponseModule() {
    return await loadUIModule(repoRoot, "ui/shared/filter-response.ts");
}

async function loadFilterSpectrumModule() {
    return await loadUIModule(repoRoot, "ui/shared/filter-spectrum.ts");
}

async function loadDistortionVisualizationModule() {
    return await loadUIModule(repoRoot, "ui/shared/distortion-visualization.ts");
}

test("display position matching ignores float noise after clamping but still rejects a real movement", async () => {
    const { displayPositionsMatch } = await loadRuntimeTableStateModule();

    assert.equal(displayPositionsMatch(0.5, 0.5000004), true);
    assert.equal(displayPositionsMatch(-4, 0), true);
    assert.equal(displayPositionsMatch(3, 1), true);
    assert.equal(displayPositionsMatch(0.5, 0.50002), false);
});

test("display drag mapping follows upward finger motion and clamps at the ends", async () => {
    const { mapDisplayDragToPosition } = await loadRuntimeTableStateModule();

    assert.equal(mapDisplayDragToPosition(0.25, 200, 120, 200), 0.65);
    assert.equal(mapDisplayDragToPosition(0.9, 200, -100, 120), 1);
    assert.equal(mapDisplayDragToPosition(0.1, 200, 500, 120), 0);
    assert.equal(mapDisplayDragToPosition(0.4, 100, 99, 0), 1);
});

test("effective wavetable position normalization accepts wrapped payloads and rejects malformed ones", async () => {
    const { normalizeEffectiveWavetablePositionMessage } = await loadRuntimeTableStateModule();

    assert.deepEqual(normalizeEffectiveWavetablePositionMessage(0.75), {
        voiceGeneration: 0,
        position: 0.75,
    });
    assert.deepEqual(normalizeEffectiveWavetablePositionMessage({
        event: {
            voiceGeneration: 3.9,
            position: 1.2,
        },
    }), {
        voiceGeneration: 3,
        position: 1,
    });
    assert.equal(normalizeEffectiveWavetablePositionMessage({ event: { voiceGeneration: 2 } }), null);
    assert.equal(normalizeEffectiveWavetablePositionMessage(null), null);
});

test("observed wavetable position state keeps the newest voice generation only", async () => {
    const { selectObservedWavetablePositionState } = await loadRuntimeTableStateModule();
    const previousState = {
        voiceGeneration: 5,
        position: 0.4,
    };

    assert.deepEqual(
        selectObservedWavetablePositionState(previousState, {
            event: {
                voiceGeneration: 4,
                position: 0.9,
            },
        }),
        previousState,
    );
    assert.deepEqual(
        selectObservedWavetablePositionState(previousState, {
            event: {
                voiceGeneration: 6,
                position: 0.9,
            },
        }),
        {
            voiceGeneration: 6,
            position: 0.9,
        },
    );
    assert.deepEqual(
        selectObservedWavetablePositionState(null, 0.33),
        {
            voiceGeneration: 0,
            position: 0.33,
        },
    );
});

test("effective filter state normalization accepts wrapped payloads and rejects malformed ones", async () => {
    const { normalizeEffectiveFilterStateMessage, FILTER_MODE_BANDPASS } = await loadRuntimeTableStateModule();

    assert.deepEqual(normalizeEffectiveFilterStateMessage({
        event: {
            voiceGeneration: 3.9,
            hasActive: 1,
            mode: FILTER_MODE_BANDPASS,
            cutoffHz: 22050,
            q: 1.7,
        },
    }), {
        voiceGeneration: 3,
        hasActive: true,
        mode: FILTER_MODE_BANDPASS,
        cutoffHz: 20000,
        q: 1.7,
    });
    assert.deepEqual(normalizeEffectiveFilterStateMessage({
        event: {
            voiceGeneration: 0,
            hasActive: 0,
            mode: 0,
            cutoffHz: 10,
            q: 0.01,
        },
    }), {
        voiceGeneration: 0,
        hasActive: false,
        mode: 0,
        cutoffHz: 20,
        q: 0.1,
    });
    assert.equal(
        normalizeEffectiveFilterStateMessage({ event: { voiceGeneration: 2, mode: 1, cutoffHz: 1000 } }),
        null,
    );
    assert.equal(normalizeEffectiveFilterStateMessage(null), null);
});

test("observed filter state keeps the newest voice generation and preserves valid state on malformed messages", async () => {
    const { selectObservedEffectiveFilterState, FILTER_MODE_LOWPASS } = await loadRuntimeTableStateModule();
    const previousState = {
        voiceGeneration: 5,
        hasActive: true,
        mode: FILTER_MODE_LOWPASS,
        cutoffHz: 1800,
        q: 1.2,
    };

    assert.deepEqual(
        selectObservedEffectiveFilterState(previousState, {
            event: {
                voiceGeneration: 4,
                hasActive: 1,
                mode: 3,
                cutoffHz: 4200,
                q: 0.8,
            },
        }),
        previousState,
    );
    assert.deepEqual(
        selectObservedEffectiveFilterState(previousState, {
            event: {
                voiceGeneration: 7,
                hasActive: 0,
                mode: 0,
                cutoffHz: 1200,
                q: 0.707,
            },
        }),
        {
            voiceGeneration: 7,
            hasActive: false,
            mode: 0,
            cutoffHz: 1200,
            q: 0.707,
        },
    );
    assert.deepEqual(
        selectObservedEffectiveFilterState(previousState, { event: { voiceGeneration: 8 } }),
        previousState,
    );
});

test("effective warp state normalization accepts wrapped payloads and rejects malformed ones", async () => {
    const { normalizeEffectiveWarpStateMessage, WARP_MODE_MIRROR } = await loadRuntimeTableStateModule();

    assert.deepEqual(normalizeEffectiveWarpStateMessage({
        event: {
            voiceGeneration: 4.8,
            hasActive: 1,
            mode: WARP_MODE_MIRROR,
            amount: 1.3,
        },
    }), {
        voiceGeneration: 4,
        hasActive: true,
        mode: WARP_MODE_MIRROR,
        amount: 1,
    });
    assert.deepEqual(normalizeEffectiveWarpStateMessage({
        event: {
            voiceGeneration: 0,
            hasActive: 0,
            mode: -3,
            amount: -0.25,
        },
    }), {
        voiceGeneration: 0,
        hasActive: false,
        mode: 0,
        amount: 0,
    });
    assert.equal(
        normalizeEffectiveWarpStateMessage({ event: { voiceGeneration: 2, mode: 1 } }),
        null,
    );
    assert.equal(normalizeEffectiveWarpStateMessage(null), null);
});

test("observed warp state keeps the newest voice generation and preserves valid state on malformed messages", async () => {
    const { selectObservedEffectiveWarpState, WARP_MODE_BEND } = await loadRuntimeTableStateModule();
    const previousState = {
        voiceGeneration: 5,
        hasActive: true,
        mode: WARP_MODE_BEND,
        amount: 0.83,
    };

    assert.deepEqual(
        selectObservedEffectiveWarpState(previousState, {
            event: {
                voiceGeneration: 4,
                hasActive: 1,
                mode: 4,
                amount: 0.2,
            },
        }),
        previousState,
    );
    assert.deepEqual(
        selectObservedEffectiveWarpState(previousState, {
            event: {
                voiceGeneration: 6,
                hasActive: 0,
                mode: 0,
                amount: 0.1,
            },
        }),
        {
            voiceGeneration: 6,
            hasActive: false,
            mode: 0,
            amount: 0.1,
        },
    );
    assert.deepEqual(
        selectObservedEffectiveWarpState(previousState, { event: { voiceGeneration: 7, hasActive: 1, mode: 1 } }),
        previousState,
    );
});

test("filter cutoff normalization uses a logarithmic mapping", async () => {
    const {
        filterCutoffHzToNormalized,
        normalizedToFilterCutoffHz,
    } = await loadFilterResponseModule();

    const normalizedA = filterCutoffHzToNormalized(200);
    const normalizedB = filterCutoffHzToNormalized(2000);
    const normalizedC = filterCutoffHzToNormalized(20000);

    assert.ok(Math.abs(normalizedB - normalizedA - (normalizedC - normalizedB)) < 0.02);
    assert.ok(Math.abs(normalizedToFilterCutoffHz(normalizedA) - 200) < 5);
    assert.ok(Math.abs(normalizedToFilterCutoffHz(normalizedB) - 2000) < 50);
});

test("filter response curves show the expected shape for lowpass, highpass, bandpass, notch, and peak", async () => {
    const {
        FILTER_MODE_LOWPASS,
        FILTER_MODE_HIGHPASS,
        FILTER_MODE_BANDPASS,
        FILTER_MODE_NOTCH,
        FILTER_MODE_PEAK,
        createFilterResponseModel,
    } = await loadFilterResponseModule();
    const sampleRate = 44100;
    const cutoffHz = 1200;
    const q = 3.5;

    const lowpass = createFilterResponseModel({ mode: FILTER_MODE_LOWPASS, cutoffHz, q, sampleRate });
    const highpass = createFilterResponseModel({ mode: FILTER_MODE_HIGHPASS, cutoffHz, q, sampleRate });
    const bandpass = createFilterResponseModel({ mode: FILTER_MODE_BANDPASS, cutoffHz, q, sampleRate });
    const notch = createFilterResponseModel({ mode: FILTER_MODE_NOTCH, cutoffHz, q, sampleRate });
    const peak = createFilterResponseModel({ mode: FILTER_MODE_PEAK, cutoffHz, q, sampleRate });

    assert.ok(lowpass.magnitudesDb[4] > lowpass.magnitudesDb[lowpass.magnitudesDb.length - 4]);
    assert.ok(highpass.magnitudesDb[4] < highpass.magnitudesDb[highpass.magnitudesDb.length - 4]);
    assert.equal(bandpass.peakIndex > 8 && bandpass.peakIndex < bandpass.magnitudesDb.length - 8, true);
    assert.equal(notch.minIndex > 8 && notch.minIndex < notch.magnitudesDb.length - 8, true);
    assert.ok(peak.magnitudesDb[peak.peakIndex] > 3.0);
});

test("higher Q narrows and raises the bandpass response", async () => {
    const {
        FILTER_MODE_BANDPASS,
        createFilterResponseModel,
        magnitudeAtFrequency,
    } = await loadFilterResponseModule();
    const sampleRate = 44100;
    const cutoffHz = 1200;
    const lowQ = createFilterResponseModel({ mode: FILTER_MODE_BANDPASS, cutoffHz, q: 0.707, sampleRate });
    const highQ = createFilterResponseModel({ mode: FILTER_MODE_BANDPASS, cutoffHz, q: 6.0, sampleRate });
    const lowQCenter = magnitudeAtFrequency(lowQ, cutoffHz);
    const highQCenter = magnitudeAtFrequency(highQ, cutoffHz);
    const lowQOffBand = magnitudeAtFrequency(lowQ, cutoffHz * 2.5);
    const highQOffBand = magnitudeAtFrequency(highQ, cutoffHz * 2.5);

    assert.ok(lowQCenter < highQCenter);
    assert.ok((highQCenter - highQOffBand) > (lowQCenter - lowQOffBand));
});

test("filter spectrum normalization accepts wrapped payloads and rejects malformed messages", async () => {
    const { normalizeFilterSpectrumMessage } = await loadFilterSpectrumModule();

    assert.deepEqual(normalizeFilterSpectrumMessage({
        event: {
            sampleRateHz: 48_000,
            magnitudes: [0, 1, 2, 3, 4, 5, 6, 7],
        },
    }), {
        sampleRateHz: 48_000,
        magnitudes: [0, 1, 2, 3, 4, 5, 6, 7],
    });
    assert.equal(normalizeFilterSpectrumMessage({
        event: {
            sampleRateHz: "broken",
            magnitudes: [0, 1, 2, 3, 4, 5, 6, 7],
        },
    }), null);
    assert.equal(normalizeFilterSpectrumMessage({
        event: {
            sampleRateHz: 44_100,
            magnitudes: [0, 1, 2],
        },
    }), null);
});

test("filter spectrum bands are dense, monotonic, and log-spaced", async () => {
    const {
        buildFilterSpectrumBands,
        buildFilterSpectrumGraphPoints,
        FILTER_SPECTRUM_BAND_COUNT,
        FILTER_SPECTRUM_GRAPH_POINT_COUNT,
    } = await loadFilterSpectrumModule();

    const bands = buildFilterSpectrumBands();
    const graphPoints = buildFilterSpectrumGraphPoints();

    assert.equal(bands.length, FILTER_SPECTRUM_BAND_COUNT);
    assert.equal(graphPoints.length, FILTER_SPECTRUM_GRAPH_POINT_COUNT);
    assert.ok(graphPoints.length > bands.length);
    assert.ok(bands.length >= 120);
    assert.ok(Math.abs(bands[0].lowHz - 20) < 1e-6);
    assert.ok(Math.abs(bands[bands.length - 1].highHz - 20_000) < 1e-6);

    for (let index = 1; index < bands.length; index += 1) {
        assert.ok(bands[index].lowHz > bands[index - 1].lowHz);
        assert.ok(bands[index].centerHz > bands[index - 1].centerHz);
        assert.ok(bands[index].highHz > bands[index - 1].highHz);
        assert.ok(bands[index].lowHz < bands[index].centerHz);
        assert.ok(bands[index].centerHz < bands[index].highHz);
    }

    const ratioNearStart = bands[10].centerHz / bands[9].centerHz;
    const ratioNearMiddle = bands[60].centerHz / bands[59].centerHz;
    const ratioNearEnd = bands[110].centerHz / bands[109].centerHz;
    assert.ok(Math.abs(ratioNearStart - ratioNearMiddle) < 0.01);
    assert.ok(Math.abs(ratioNearMiddle - ratioNearEnd) < 0.01);
});

test("filter spectrum display frame preserves low-frequency and high-frequency emphasis and keeps absolute dB differences", async () => {
    const {
        buildFilterSpectrumBands,
        buildFilterSpectrumGraphPoints,
        createFilterSpectrumDisplayFrame,
        FILTER_SPECTRUM_MIN_DB,
    } = await loadFilterSpectrumModule();
    const bands = buildFilterSpectrumBands();
    const graphPoints = buildFilterSpectrumGraphPoints();
    const lowHeavyMagnitudes = Array.from({ length: 64 }, (_, index) => (
        index === 2 ? 0.03 : index === 3 ? 0.022 : 1e-5
    ));
    const highHeavyMagnitudes = Array.from({ length: 64 }, (_, index) => (
        index === 60 ? 0.03 : index === 58 ? 0.022 : 1e-5
    ));
    const lowerLevelMagnitudes = lowHeavyMagnitudes.map((value) => value * 0.5);

    const lowHeavyDisplay = createFilterSpectrumDisplayFrame({
        frame: {
            sampleRateHz: 44_100,
            magnitudes: lowHeavyMagnitudes,
        },
        bands,
        graphPoints,
    });
    const highHeavyDisplay = createFilterSpectrumDisplayFrame({
        frame: {
            sampleRateHz: 44_100,
            magnitudes: highHeavyMagnitudes,
        },
        bands,
        graphPoints,
    });
    const lowerLevelDisplay = createFilterSpectrumDisplayFrame({
        frame: {
            sampleRateHz: 44_100,
            magnitudes: lowerLevelMagnitudes,
        },
        bands,
        graphPoints,
    });
    const silentDisplay = createFilterSpectrumDisplayFrame({
        frame: {
            sampleRateHz: 44_100,
            magnitudes: new Array(64).fill(0),
        },
        bands,
        graphPoints,
    });

    assert.ok(lowHeavyDisplay);
    assert.ok(highHeavyDisplay);
    assert.ok(lowerLevelDisplay);
    assert.ok(silentDisplay);
    assert.ok(lowHeavyDisplay.peakBandIndex < highHeavyDisplay.peakBandIndex);
    assert.ok(lowHeavyDisplay.peakGraphPointIndex < highHeavyDisplay.peakGraphPointIndex);
    assert.equal(lowHeavyDisplay.graphMagnitudesDb.length, graphPoints.length);
    assert.ok((lowHeavyDisplay.bandMagnitudesDb[lowHeavyDisplay.peakBandIndex] - lowerLevelDisplay.bandMagnitudesDb[lowerLevelDisplay.peakBandIndex]) > 5.5);
    assert.deepEqual(
        silentDisplay.bandMagnitudesDb,
        bands.map(() => FILTER_SPECTRUM_MIN_DB),
    );
    assert.deepEqual(
        silentDisplay.graphMagnitudesDb,
        graphPoints.map(() => FILTER_SPECTRUM_MIN_DB),
    );
});

test("filter spectrum smoothing decays gradually and peak hold persists before fading", async () => {
    const {
        advanceFilterSpectrumDisplayState,
        buildFilterSpectrumBands,
        buildFilterSpectrumGraphPoints,
        createFilterSpectrumDisplayFrame,
    } = await loadFilterSpectrumModule();

    const bands = buildFilterSpectrumBands();
    const graphPoints = buildFilterSpectrumGraphPoints();
    const firstLoudFrame = createFilterSpectrumDisplayFrame({
        frame: {
            sampleRateHz: 44_100,
            magnitudes: Array.from({ length: 64 }, (_, index) => (index === 2 ? 0.03 : 1e-5)),
        },
        bands,
        graphPoints,
    });
    const quieterFrame = createFilterSpectrumDisplayFrame({
        frame: {
            sampleRateHz: 44_100,
            magnitudes: Array.from({ length: 64 }, (_, index) => (index === 2 ? 0.002 : 1e-5)),
        },
        bands,
        graphPoints,
    });

    const firstState = advanceFilterSpectrumDisplayState(null, firstLoudFrame, 0);
    const holdState = advanceFilterSpectrumDisplayState(firstState, quieterFrame, 100);
    const fadedState = advanceFilterSpectrumDisplayState(holdState, quieterFrame, 500);

    const peakIndex = firstState.peakBandIndex;
    assert.equal(firstState.smoothedMagnitudesDb[peakIndex], firstState.bandMagnitudesDb[peakIndex]);
    assert.equal(firstState.peakMagnitudesDb[peakIndex], firstState.bandMagnitudesDb[peakIndex]);
    assert.ok(holdState.smoothedMagnitudesDb[peakIndex] > quieterFrame.bandMagnitudesDb[peakIndex]);
    assert.equal(holdState.peakMagnitudesDb[peakIndex], firstState.peakMagnitudesDb[peakIndex]);
    assert.ok(fadedState.peakMagnitudesDb[peakIndex] < holdState.peakMagnitudesDb[peakIndex]);
    assert.ok(fadedState.peakMagnitudesDb[peakIndex] >= fadedState.smoothedMagnitudesDb[peakIndex]);
});

test("filter spectrum render modes cycle predictably and change geometry shape", async () => {
    const {
        FILTER_SPECTRUM_RENDER_MODE_OPTIONS,
        buildFilterSpectrumBands,
        buildFilterSpectrumGraphPoints,
        buildFilterSpectrumRenderGeometry,
        createFilterSpectrumDisplayFrame,
        advanceFilterSpectrumDisplayState,
        cycleFilterSpectrumRenderMode,
    } = await loadFilterSpectrumModule();

    assert.deepEqual(
        FILTER_SPECTRUM_RENDER_MODE_OPTIONS.map((option) => option.value),
        ["graph", "bars", "round-bars"],
    );
    assert.equal(cycleFilterSpectrumRenderMode("graph"), "bars");
    assert.equal(cycleFilterSpectrumRenderMode("bars"), "round-bars");
    assert.equal(cycleFilterSpectrumRenderMode("round-bars"), "graph");

    const frame = createFilterSpectrumDisplayFrame({
        frame: {
            sampleRateHz: 44_100,
            magnitudes: Array.from({ length: 64 }, (_, index) => (
                index === 2 ? 0.03 : index === 3 ? 0.018 : index === 48 ? 0.012 : 1e-5
            )),
        },
        bands: buildFilterSpectrumBands(),
        graphPoints: buildFilterSpectrumGraphPoints(),
    });
    const displayState = advanceFilterSpectrumDisplayState(null, frame, 0);
    const graphGeometry = buildFilterSpectrumRenderGeometry({
        renderMode: "graph",
        width: 640,
        height: 240,
        displayState,
    });
    const barsGeometry = buildFilterSpectrumRenderGeometry({
        renderMode: "bars",
        width: 640,
        height: 240,
        displayState,
    });
    const roundBarsGeometry = buildFilterSpectrumRenderGeometry({
        renderMode: "round-bars",
        width: 640,
        height: 240,
        displayState,
    });

    assert.equal(graphGeometry.kind, "graph");
    assert.equal(graphGeometry.pointCount, displayState.graphPoints.length);
    assert.equal(barsGeometry.kind, "bars");
    assert.equal(barsGeometry.barCount, displayState.bands.length);
    assert.equal(barsGeometry.rounded, false);
    assert.equal(roundBarsGeometry.kind, "bars");
    assert.equal(roundBarsGeometry.barCount, displayState.bands.length);
    assert.equal(roundBarsGeometry.rounded, true);
    assert.ok(roundBarsGeometry.bars.every((bar) => bar.radius >= 0));
    assert.ok(roundBarsGeometry.bars.some((bar) => bar.radius > 0));
});

test("filter spectrum tick helpers expose readable frequency and dB labels", async () => {
    const { buildFilterSpectrumFrequencyTicks, buildFilterSpectrumDbTicks } = await loadFilterSpectrumModule();

    const frequencyTicks = buildFilterSpectrumFrequencyTicks();
    const dbTicks = buildFilterSpectrumDbTicks();

    assert.deepEqual(
        frequencyTicks.map((tick) => tick.label),
        ["20", "50", "100", "200", "500", "1k", "2k", "5k", "10k", "20k"],
    );
    assert.deepEqual(
        dbTicks.map((tick) => tick.label),
        ["-18", "-36", "-54", "-72", "-90"],
    );
    for (let index = 1; index < frequencyTicks.length; index += 1) {
        assert.ok(frequencyTicks[index].normalizedX > frequencyTicks[index - 1].normalizedX);
    }
    for (let index = 1; index < dbTicks.length; index += 1) {
        assert.ok(dbTicks[index].normalizedY > dbTicks[index - 1].normalizedY);
    }
});

test("runtime table presentation falls back cleanly when no runtime state exists", async () => {
    const { resolveRuntimeTablePresentation } = await loadRuntimeTableStateModule();

    assert.deepEqual(resolveRuntimeTablePresentation(null, 7), {
        desiredTableIndex: 7,
        presentedTableIndex: 7,
        activeTableIndex: null,
        activeGeneration: null,
        loadingTableIndex: null,
        loadingGeneration: null,
        isPendingSelection: false,
        isRetryableFailure: false,
        failureMessage: null,
    });
});

test("runtime table presentation keeps the audible table visible while another desired table is pending", async () => {
    const { resolveRuntimeTablePresentation } = await loadRuntimeTableStateModule();

    assert.deepEqual(resolveRuntimeTablePresentation({
        event: {
            desiredTableIndex: 5,
            desiredIntentSerial: 9,
            serviceState: 1,
            hasActive: true,
            activeTableIndex: 2,
            activeGeneration: 11,
            hasLoading: false,
            loadingTableIndex: 0,
            loadingGeneration: 0,
            hasFailure: false,
            failedTableIndex: 0,
            failedGeneration: 0,
            failureScope: 0,
            failurePhase: 0,
            failureReasonCode: 0,
        },
    }), {
        desiredTableIndex: 5,
        presentedTableIndex: 2,
        activeTableIndex: 2,
        activeGeneration: 11,
        loadingTableIndex: null,
        loadingGeneration: null,
        isPendingSelection: true,
        isRetryableFailure: false,
        failureMessage: null,
    });
});

test("runtime table presentation exposes retryable desired-table failures with the right message", async () => {
    const { resolveRuntimeTablePresentation, describeRuntimeTableFailureDetails } = await loadRuntimeTableStateModule();
    const failureState = {
        event: {
            desiredTableIndex: 3,
            desiredIntentSerial: 4,
            serviceState: 1,
            hasActive: false,
            activeTableIndex: 0,
            activeGeneration: 0,
            hasLoading: false,
            loadingTableIndex: 0,
            loadingGeneration: 0,
            hasFailure: true,
            failedTableIndex: 3,
            failedGeneration: 9,
            failureScope: 1,
            failurePhase: 3,
            failureReasonCode: 2,
        },
    };

    assert.deepEqual(resolveRuntimeTablePresentation(failureState), {
        desiredTableIndex: 3,
        presentedTableIndex: 3,
        activeTableIndex: null,
        activeGeneration: null,
        loadingTableIndex: null,
        loadingGeneration: null,
        isPendingSelection: false,
        isRetryableFailure: true,
        failureMessage: "Wavetable load timed out.",
    });
    assert.equal(
        describeRuntimeTableFailureDetails(failureState.event, "BS2 - Acid"),
        "BS2 - Acid failed during mip transfer (committed load, generation 9, timeout).",
    );
});

test("display gesture axis stays pending until motion crosses the lock threshold", async () => {
    const { resolveDisplayGestureAxis } = await loadDisplayGestureModule();

    assert.equal(resolveDisplayGestureAxis(4, 5), "pending");
    assert.equal(resolveDisplayGestureAxis(16, 8), "horizontal");
    assert.equal(resolveDisplayGestureAxis(7, 18), "vertical");
});

test("horizontal swipe targeting advances one table and clamps at either edge", async () => {
    const { resolveHorizontalSwipeTarget } = await loadDisplayGestureModule();

    assert.deepEqual(resolveHorizontalSwipeTarget(3, -64, 8), {
        direction: 1,
        targetTableIndex: 4,
        hasTarget: true,
    });
    assert.deepEqual(resolveHorizontalSwipeTarget(3, 64, 8), {
        direction: -1,
        targetTableIndex: 2,
        hasTarget: true,
    });
    assert.deepEqual(resolveHorizontalSwipeTarget(0, 64, 8), {
        direction: -1,
        targetTableIndex: 0,
        hasTarget: false,
    });
    assert.deepEqual(resolveHorizontalSwipeTarget(7, -64, 8), {
        direction: 1,
        targetTableIndex: 7,
        hasTarget: false,
    });
});

test("distortion scope normalization unwraps endpoint payloads and recomputes peaks when needed", async () => {
    const { normalizeDistortionScopeMessage } = await loadDistortionVisualizationModule();

    const normalized = normalizeDistortionScopeMessage({
        event: {
            sampleRateHz: 48_000,
            dominantChannel: 1.7,
            inputSamples: [-1.4, -0.25, 0, 1.1],
            outputSamples: [-1, -0.25, 0, 0.94],
        },
    });

    assert.equal(normalized?.sampleRateHz, 48_000);
    assert.equal(normalized?.dominantChannel, 1);
    assert.equal(normalized?.inputPeak, 1.4);
    assert.equal(normalized?.outputPeak, 1);
    assert.equal(Math.abs((normalized?.removedPeak ?? 0) - 0.4) <= 1e-9, true);
    assert.deepEqual(normalized?.inputSamples, [-1.4, -0.25, 0, 1.1]);
    assert.deepEqual(normalized?.outputSamples, [-1, -0.25, 0, 0.94]);
    assert.equal(normalizeDistortionScopeMessage({ event: { inputSamples: [0.1] } }), null);
});

test("distortion display range stays fixed while the active frame updates", async () => {
    const { advanceDistortionDisplayState } = await loadDistortionVisualizationModule();

    const loudFrame = {
        sampleRateHz: 44_100,
        dominantChannel: 0,
        inputPeak: 1.82,
        outputPeak: 1,
        removedPeak: 0.82,
        inputSamples: [-1.82, -0.6, 0.3, 1.64],
        outputSamples: [-1, -0.55, 0.29, 0.97],
    };
    const quietFrame = {
        sampleRateHz: 44_100,
        dominantChannel: 0,
        inputPeak: 0.44,
        outputPeak: 0.41,
        removedPeak: 0.03,
        inputSamples: [-0.44, -0.15, 0.1, 0.34],
        outputSamples: [-0.41, -0.14, 0.1, 0.33],
    };

    const firstState = advanceDistortionDisplayState(null, loudFrame, 0);
    const heldState = advanceDistortionDisplayState(firstState, quietFrame, 120);

    assert.equal(firstState.displayRange, 2);
    assert.equal(heldState.displayRange, 2);
    assert.deepEqual(heldState.frame, quietFrame);
});

test("distortion curve family stays symmetric and sample classification marks removed peaks", async () => {
    const {
        buildDistortionSamplePoints,
        buildDistortionTransferOccupancy,
        sampleDistortionCurve,
        shapeDistortionSample,
    } = await loadDistortionVisualizationModule();

    const curve = sampleDistortionCurve({
        knee: 0.65,
        inputRange: 2,
        pointCount: 5,
    });
    assert.equal(curve[0].input, -2);
    assert.equal(curve[curve.length - 1].input, 2);
    assert.equal(Math.abs(curve[0].output + curve[curve.length - 1].output) <= 1e-9, true);
    assert.equal(Math.abs(shapeDistortionSample(-0.9, 0.65) + shapeDistortionSample(0.9, 0.65)) <= 1e-9, true);

    const points = buildDistortionSamplePoints({
        sampleRateHz: 44_100,
        dominantChannel: 0,
        inputPeak: 1.2,
        outputPeak: 1,
        removedPeak: 0.2,
        inputSamples: [-1.2, -0.2, 0.15, 1.1],
        outputSamples: [-1, -0.2, 0.15, 0.96],
    });
    assert.deepEqual(points.map((point) => point.clipped), [true, false, false, true]);

    const forwardOccupancy = buildDistortionTransferOccupancy({
        samplePoints: points,
        knee: 0.65,
        inputRange: 2,
        binCount: 17,
    });
    const reversedOccupancy = buildDistortionTransferOccupancy({
        samplePoints: [...points].reverse(),
        knee: 0.65,
        inputRange: 2,
        binCount: 17,
    });
    const summarizeOccupancy = (occupancy) => ({
        leftOverflowCount: occupancy.leftOverflowCount,
        rightOverflowCount: occupancy.rightOverflowCount,
        peakDensity: Number(occupancy.peakDensity.toFixed(4)),
        peakRemoved: Number(occupancy.peakRemoved.toFixed(4)),
        segments: occupancy.segments.map((segment) => segment.map((point) => ({
            input: Number(point.input.toFixed(3)),
            density: Number(point.density.toFixed(4)),
            removed: Number(point.removed.toFixed(4)),
            clipped: Number(point.clipped.toFixed(4)),
        }))),
    });

    assert.equal(forwardOccupancy.segments.length > 0, true);
    assert.equal(forwardOccupancy.peakRemoved > 0, true);
    assert.deepEqual(
        summarizeOccupancy(forwardOccupancy),
        summarizeOccupancy(reversedOccupancy),
    );
});

test("horizontal swipe commit threshold uses the greater of the minimum distance and stage ratio", async () => {
    const { shouldCommitHorizontalSwipe } = await loadDisplayGestureModule();

    assert.equal(shouldCommitHorizontalSwipe(47, 100), false);
    assert.equal(shouldCommitHorizontalSwipe(48, 100), true);
    assert.equal(shouldCommitHorizontalSwipe(107, 600), false);
    assert.equal(shouldCommitHorizontalSwipe(108, 600), true);
});

test("keyboard geometry counts natural notes across the visible range and never returns zero", async () => {
    const { countNaturalNotesInRange } = await loadKeyboardGeometryModule();

    assert.equal(countNaturalNotesInRange(24, 12), 7);
    assert.equal(countNaturalNotesInRange(25, 12), 7);
    assert.equal(countNaturalNotesInRange(25, 1), 1);
});

test("keyboard geometry clamps natural width and derives the accidental width from it", async () => {
    const { computeKeyboardDimensions } = await loadKeyboardGeometryModule();

    assert.deepEqual(
        Object.fromEntries(
            Object.entries(computeKeyboardDimensions({
                rootNote: 24,
                noteCount: 12,
                availableWidth: 180,
            })).map(([key, value]) => [key, typeof value === "number" ? Number(value.toFixed(3)) : value]),
        ),
        {
            naturalCount: 7,
            naturalWidth: 25.571,
            accidentalWidth: 14.831,
        },
    );
    assert.deepEqual(
        Object.fromEntries(
            Object.entries(computeKeyboardDimensions({
                rootNote: 24,
                noteCount: 12,
                availableWidth: 50,
            })).map(([key, value]) => [key, typeof value === "number" ? Number(value.toFixed(3)) : value]),
        ),
        {
            naturalCount: 7,
            naturalWidth: 18,
            accidentalWidth: 10.44,
        },
    );
});
