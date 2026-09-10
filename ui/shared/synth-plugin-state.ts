import { definePluginState, parameter, storedValue } from "../../kit/index";
import { createDefaultModulationState, MODULATION_STATE_KEY } from "./modulation";
import { modulationStateCodec } from "./synth-modulation-state";

/** Voice parameters and the existing editable modulation document share one history. */
export const synthPluginState = definePluginState({
    playMode: parameter("playMode"),
    glideTime: parameter("glideTime"),
    globalTune: parameter("globalTune"),
    [MODULATION_STATE_KEY]: storedValue({ initial: createDefaultModulationState(), codec: modulationStateCodec }),
});
