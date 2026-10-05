import { definePluginState, parameter, presets, snapshots } from "../../kit/index";

/**
 * Every EnhancerPlugin.cmajor parameter, keyed by the setting names the synth's
 * Enhancer state uses. Slider drags, button presses, presets and A-G snapshots
 * share one Undo history.
 */
export default definePluginState({
    b1FreqHz: parameter("b1FreqHzIn"),
    b1Q: parameter("b1QIn"),
    b1Mode: parameter("b1ModeIn"),
    b1MidAmount: parameter("b1MidAmountIn"),
    b1SideAmount: parameter("b1SideAmountIn"),
    b1Curve: parameter("b1CurveIn"),
    b2FreqHz: parameter("b2FreqHzIn"),
    b2Q: parameter("b2QIn"),
    b2Mode: parameter("b2ModeIn"),
    b2MidAmount: parameter("b2MidAmountIn"),
    b2SideAmount: parameter("b2SideAmountIn"),
    b2Curve: parameter("b2CurveIn"),
    saturationMode: parameter("saturationModeIn"),
    deEmphasis: parameter("deEmphasisIn"),
    ...presets(),
    ...snapshots(),
});
