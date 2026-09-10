import { definePluginState, parameter } from "../../kit/index";

/** The Voice controls currently owned by the shared plugin state service. */
export const synthPluginState = definePluginState({
    playMode: parameter("playMode"),
    glideTime: parameter("glideTime"),
    globalTune: parameter("globalTune"),
});
