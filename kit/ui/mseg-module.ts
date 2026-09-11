/** Public MSEG vocabulary: independent editable curve, editor, and direct engine preparation. */
export { createDefaultMsegShape as defaultCurve, renderMsegShapeInto as renderInto, MSEG_PADDED_SAMPLES as sampleCount } from "./mseg";
export type { MsegShape as Curve, MsegPoint as Point, MsegPlayback as Playback } from "./mseg";
export { msegCurveCodec as curveCodec, msegState as state } from "./mseg-state";
export { MsegEditor as Editor, MsegEditorSurface as Surface } from "./mseg-editor";
export { moveMsegPoint as movePoint, addMsegPoint as addPoint, deleteMsegPoint as deletePoint, setMsegSegmentCurvePower as setCurvePower } from "./mseg";
