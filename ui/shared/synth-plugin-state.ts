import { definePluginState, parameter, preparedState } from "../../kit/index";
import { createDefaultModulationState, MODULATION_STATE_KEY } from "./modulation";
import { modulationStateCodec } from "./synth-modulation-state";

/** Voice parameters and the existing editable modulation document share one history. */
import { synthModulationDelivery } from "../worker/synth-modulation-binding";

export const synthPluginState = definePluginState({
    playMode: parameter("playMode"),
    glideTime: parameter("glideTime"),
    globalTune: parameter("globalTune"),
    [MODULATION_STATE_KEY]: preparedState({ initial: createDefaultModulationState(), codec: modulationStateCodec, prepare: value => value, engine: synthModulationDelivery }),
});
