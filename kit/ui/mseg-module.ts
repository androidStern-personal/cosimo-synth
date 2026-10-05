/** Public MSEG vocabulary: independent editable curve, editor, and direct engine preparation. */
export {
    createDefaultMsegShape as defaultCurve,
    renderMsegShapeInto as renderInto,
    MSEG_PADDED_SAMPLES as sampleCount,
} from './mseg'
export type { MsegShape as Curve, MsegPoint as Point } from './mseg'
export { msegCurveCodec as curveCodec, msegState as state } from './mseg-state'
export {
    MsegEditor as Editor,
    MsegRoot as Root,
    MsegSurface as Surface,
    MsegGrid as Grid,
    MsegLine as Line,
    MsegFill as Fill,
    MsegPoints as Points,
    MsegPlot as Plot,
    MsegSegmentHighlight as SegmentHighlight,
    MsegTimeAxis as TimeAxis,
    MsegPlayhead as Playhead,
    useMsegEditor as useEditor,
} from './mseg-composition'
export type {
    MsegEditorProps as EditorProps,
    MsegRootProps as RootProps,
    MsegSurfaceProps as SurfaceProps,
    MsegSelection as Selection,
    MsegEditing as Editing,
    MsegPointRender as PointRender,
} from './mseg-composition'
export {
    moveMsegPoint as movePoint,
    addMsegPoint as addPoint,
    deleteMsegPoint as deletePoint,
    setMsegSegmentCurvePower as setCurvePower,
} from './mseg'

export { msegPositionSource as positionSource } from './mseg-position'
