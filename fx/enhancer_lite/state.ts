import { definePluginState, parameter } from "../../kit/index";

/** The eight automatable sound controls share one persistent edit and Undo owner. */
export default definePluginState({
    frequency: parameter("freqHzIn"),
    q: parameter("qIn"),
    routing: parameter("modeIn"),
    amount: parameter("midAmountIn"),
    sideAmount: parameter("sideAmountIn"),
    character: parameter("curveIn"),
    intensity: parameter("saturationModeIn"),
    shape: parameter("shapeIn"),
});
