import { definePluginState, parameter, preparedState, presets, snapshots } from "../../kit/index";
import { patternUploadDelivery } from "./pattern-upload";
import { factoryPresets } from "./view/factory-presets";
import { buildSeqPatternContent, createDefaultSeqFxState, seqFxPatternsCodec } from "./view/seqfx-state";

/**
 * SeqFX's sound: the nine automatable global controls and the twelve step patterns.
 * The DSP holds only the selected pattern, so the patterns are re-sent whenever
 * they change or the host selects another pattern. Edits, presets, A-G snapshots
 * and Undo share one history.
 */
export default definePluginState({
    enabled: parameter("enabled"),
    mix: parameter("globalMix"),
    selectedPattern: parameter("patternSelect"),
    clock: parameter("clockMode"),
    manualBpm: parameter("manualBpm"),
    rate: parameter("rate"),
    swing: parameter("swing"),
    loopStart: parameter("loopStart"),
    loopLength: parameter("loopLength"),
    patterns: preparedState({
        codec: seqFxPatternsCodec,
        initial: createDefaultSeqFxState(),
        lifetime: "project",
        history: true,
        dependencies: ["selectedPattern"],
        prepare: (patterns, { parameters, reason }) => ({
            content: buildSeqPatternContent(patterns, Math.round(parameters["selectedPattern"] ?? 0)),
            replacesSound: reason === "load" || reason === "recall",
        }),
        engine: patternUploadDelivery,
    }),
    ...presets({ factory: factoryPresets }),
    ...snapshots(),
});
