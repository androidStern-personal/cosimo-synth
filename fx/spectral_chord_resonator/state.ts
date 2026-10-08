import { definePluginState, eventValue, parameter, presets, snapshots, storedValue } from "../../kit/index";
import { defaultPartialShape, partialShapeCodec, partialShapeUpload, type PartialShape } from "./view/partial-shape";

/**
 * Spectral Chord Resonator's sound: its twelve host parameters and the
 * harmonic partial shape, which the DSP receives on `partialShapeUpload`.
 * Knob turns, partial edits, presets and A-G snapshots share one Undo history.
 */
export default definePluginState({
    // The first host parameter is a hidden no-op that protects the slot-zero
    // behaviour the README describes. It is not part of any sound.
    hostSlot0Guard: parameter("hostSlot0Guard", { preset: false }),
    magFeedback: parameter("magFeedbackIn"),
    phaseFeedback: parameter("phaseFeedbackIn"),
    damping: parameter("dampingIn"),
    magCeiling: parameter("magCeilingIn"),
    depth: parameter("depthIn"),
    lowCutHz: parameter("lowCutHzIn"),
    maskWidthCents: parameter("maskWidthCentsIn"),
    maskFloor: parameter("maskFloorIn"),
    voiceMode: parameter("voiceModeIn"),
    polyphony: parameter("polyphonyIn"),
    voiceReleaseSeconds: parameter("voiceReleaseSecondsIn"),
    spectralMode: parameter("spectralModeIn"),
    partialShape: storedValue<PartialShape>({
        codec: partialShapeCodec,
        initial: defaultPartialShape,
        engine: eventValue<PartialShape>("partialShapeUpload", partialShapeUpload),
    }),
    ...presets(),
    ...snapshots(),
});
