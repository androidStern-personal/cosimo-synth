import { definePluginState, parameter, presets, snapshots } from "../../kit/index";

/**
 * Every PolishVoicingLab.cmajor parameter, keyed by its endpoint name: the
 * compressor, both waveshaper sides with all seven point slots, and Morph.
 * The hidden waveshaper slots are part of the sound, so presets and snapshots
 * carry the whole curve. Bypass (the Dry button) is not part of a sound, and
 * the hidden hostSlot0Guard keeps host parameter slot 0 a no-op and is not
 * plugin state.
 */
export default definePluginState({
    bypass: parameter("bypass", { preset: false }),
    thresholdDb: parameter("thresholdDb"),
    ratio: parameter("ratio"),
    kneeDb: parameter("kneeDb"),
    attackMs: parameter("attackMs"),
    releaseMs: parameter("releaseMs"),
    makeupDb: parameter("makeupDb"),

    curvePointCount: parameter("curvePointCount"),
    curveP1X: parameter("curveP1X"), curveP1Y: parameter("curveP1Y"), curveB1: parameter("curveB1"),
    curveP2X: parameter("curveP2X"), curveP2Y: parameter("curveP2Y"), curveB2: parameter("curveB2"),
    curveP3X: parameter("curveP3X"), curveP3Y: parameter("curveP3Y"), curveB3: parameter("curveB3"),
    curveP4X: parameter("curveP4X"), curveP4Y: parameter("curveP4Y"), curveB4: parameter("curveB4"),
    curveP5X: parameter("curveP5X"), curveP5Y: parameter("curveP5Y"), curveB5: parameter("curveB5"),
    curveP6X: parameter("curveP6X"), curveP6Y: parameter("curveP6Y"), curveB6: parameter("curveB6"),
    curveP7X: parameter("curveP7X"), curveP7Y: parameter("curveP7Y"), curveB7: parameter("curveB7"),

    curveNPointCount: parameter("curveNPointCount"),
    curveN1X: parameter("curveN1X"), curveN1Y: parameter("curveN1Y"), curveNB1: parameter("curveNB1"),
    curveN2X: parameter("curveN2X"), curveN2Y: parameter("curveN2Y"), curveNB2: parameter("curveNB2"),
    curveN3X: parameter("curveN3X"), curveN3Y: parameter("curveN3Y"), curveNB3: parameter("curveNB3"),
    curveN4X: parameter("curveN4X"), curveN4Y: parameter("curveN4Y"), curveNB4: parameter("curveNB4"),
    curveN5X: parameter("curveN5X"), curveN5Y: parameter("curveN5Y"), curveNB5: parameter("curveNB5"),
    curveN6X: parameter("curveN6X"), curveN6Y: parameter("curveN6Y"), curveNB6: parameter("curveNB6"),
    curveN7X: parameter("curveN7X"), curveN7Y: parameter("curveN7Y"), curveNB7: parameter("curveNB7"),

    morph: parameter("morph"),
    morphSide: parameter("morphSide"),
    morphPoint: parameter("morphPoint"),
    morphTargetX: parameter("morphTargetX"),
    morphTargetY: parameter("morphTargetY"),
    ...presets(),
    ...snapshots(),
});
