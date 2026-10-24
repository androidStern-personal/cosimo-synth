import { definePluginState, parameter, presets, snapshots } from "../../kit/index";
import { factoryPresets } from "./view/factory-presets";

/** The eight automatable sound controls share one persistent edit and Undo owner, with presets and A-G snapshots. */
export default definePluginState({
    frequency: parameter("freqHzIn"),
    q: parameter("qIn"),
    routing: parameter("modeIn"),
    amount: parameter("midAmountIn"),
    sideAmount: parameter("sideAmountIn"),
    character: parameter("curveIn"),
    intensity: parameter("saturationModeIn"),
    shape: parameter("shapeIn"),
    ...presets({ factory: factoryPresets }),
    ...snapshots(),
});
