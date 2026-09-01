import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const spectrumModulePromise = loadUIModule(
    repoRoot,
    "kit/ui/enhancer-spectrum.ts",
);

function parsePathPoints(pathValue) {
    return [...pathValue.matchAll(/[ML] ([\d.]+) ([\d.]+)/g)]
        .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
}

test("known frequency peaks, ticks, curves, handles, and drag coordinates share one log axis", async () => {
    const spectrum = await spectrumModulePromise;
    const frequencyHz = 200;
    const expectedPlotX = spectrum.enhancerFrequencyX(frequencyHz);
    const expectedRenderedX = Number(expectedPlotX.toFixed(2));

    const magnitudes = new Array(2_048).fill(0);
    magnitudes[frequencyHz] = 1;
    const display = spectrum.advanceEnhancerSpectrum(
        { sampleRateHz: 4_096, magnitudes },
        null,
        0,
    );
    assert.ok(display);

    const analyzerPeak = parsePathPoints(display.path).reduce((peak, point) => (
        point.y < peak.y ? point : peak
    ));
    const responsePath = spectrum.createEnhancerFrequencyPath((sampleFrequencyHz) => (
        spectrum.enhancerGainY(
            spectrum.enhancerBellResponseDb(sampleFrequencyHz, frequencyHz, 0.71, 1),
        )
    ));
    const responsePeak = parsePathPoints(responsePath).reduce((peak, point) => (
        point.y < peak.y ? point : peak
    ));
    const handleX = spectrum.enhancerFrequencyX(frequencyHz);

    assert.equal(spectrum.ENHANCER_FREQUENCY_TICKS.includes(frequencyHz), true);
    assert.equal(analyzerPeak.x, expectedRenderedX);
    assert.equal(responsePeak.x, expectedRenderedX);
    assert.equal(Number(handleX.toFixed(2)), expectedRenderedX);
    assert.equal(spectrum.enhancerFrequencyX(frequencyHz), expectedPlotX);

    for (const renderedWidth of [393, 820, 1_440]) {
        const clientRect = { left: 17, width: renderedWidth };
        const pointerX = spectrum.enhancerFrequencyClientX(frequencyHz, clientRect);
        const draggedFrequencyHz = spectrum.enhancerFrequencyFromClientX(pointerX, clientRect);
        assert.ok(
            Math.abs(draggedFrequencyHz - frequencyHz) < 1e-9,
            `${renderedWidth}px mapped ${frequencyHz} Hz to ${draggedFrequencyHz} Hz`,
        );

        const originFrequencyHz = 1_000;
        const targetFrequencyHz = 2_000;
        const originFrequencyX = spectrum.enhancerFrequencyClientX(
            originFrequencyHz,
            clientRect,
        );
        const targetFrequencyX = spectrum.enhancerFrequencyClientX(
            targetFrequencyHz,
            clientRect,
        );
        const offCenterGrabX = 91;
        const relativeDragResult = spectrum.enhancerFrequencyAfterClientDrag(
            originFrequencyHz,
            offCenterGrabX,
            offCenterGrabX + targetFrequencyX - originFrequencyX,
            clientRect,
        );
        assert.ok(Math.abs(relativeDragResult - targetFrequencyHz) < 1e-9);
    }
});

test("responsive tick density changes labels without changing the frequency scale", async () => {
    const spectrum = await spectrumModulePromise;
    const phoneTicks = spectrum.enhancerFrequencyTicksForWidth(393);
    const pluginTicks = spectrum.enhancerFrequencyTicksForWidth(620);
    const desktopTicks = spectrum.enhancerFrequencyTicksForWidth(1_024);

    assert.ok(phoneTicks.length < pluginTicks.length);
    assert.ok(pluginTicks.length < desktopTicks.length);
    for (const ticks of [phoneTicks, pluginTicks, desktopTicks]) {
        assert.equal(ticks[0].frequencyHz, 20);
        assert.equal(ticks.at(-1).frequencyHz, 20_000);
        for (const tick of ticks) {
            assert.equal(spectrum.ENHANCER_FREQUENCY_TICKS.includes(tick.frequencyHz), true);
            assert.equal(tick.x, spectrum.enhancerFrequencyX(tick.frequencyHz));
        }
    }

    const oneKhzPositions = [phoneTicks, pluginTicks, desktopTicks].map((ticks) => (
        ticks.find((tick) => tick.frequencyHz === 1_000)?.x
    ));
    assert.deepEqual(oneKhzPositions, [
        spectrum.enhancerFrequencyX(1_000),
        spectrum.enhancerFrequencyX(1_000),
        spectrum.enhancerFrequencyX(1_000),
    ]);

    assert.equal(spectrum.formatEnhancerFrequencyTick(20), "20 Hz");
    assert.equal(spectrum.formatEnhancerFrequencyTick(1_000), "1 kHz");
    assert.equal(spectrum.formatEnhancerFrequencyTick(20_000), "20 kHz");
});

test("the shared bell response reaches its accepted gain exactly at center frequency", async () => {
    const spectrum = await spectrumModulePromise;

    assert.ok(Math.abs(spectrum.enhancerBellResponseDb(1_000, 1_000, 0.71, 0.5) - 6) < 1e-9);
    assert.equal(spectrum.enhancerBellResponseDb(1_000, 1_000, 0.71, 0), 0);
    assert.ok(spectrum.enhancerBellResponseDb(100, 1_000, 0.71, 1) < 1);
});
