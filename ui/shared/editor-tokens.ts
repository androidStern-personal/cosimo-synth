// Editor layout numbers shared by the synth and SeqFX views. The kit owns the
// ones its filter editor uses; the stroke widths below must match editor-tokens.css.
export {
    EDITOR_PLOT_TOP_PADDING_PX,
    EDITOR_PLOT_BOTTOM_PADDING_PX,
    EDITOR_VALUE_HANDLE_RADIUS_PX,
    EDITOR_VALUE_HANDLE_HALO_RADIUS_PX,
    EDITOR_RANGE_HANDLE_RADIUS_PX,
    EDITOR_HIT_RADIUS_PX,
    EDITOR_DRAG_START_THRESHOLD_PX,
    editorPlotGutter,
} from "../../kit/ui/editor-curve-geometry";
export { useElementSize } from "../../kit/ui/use-element-size";

export const EDITOR_CURVE_STROKE_WIDTH = 2.6;
export const EDITOR_CURVE_PREVIEW_STROKE_WIDTH = 1.8;
