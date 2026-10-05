// SeqFX's editor. Edit it live with `npm run fx:dev`; `npm run fx:build -- seqfx` bundles it.
import { createStatefulPatchView, usePluginState } from "../../../kit/index";
import editorCurveSurfaceCssText from "../../../ui/shared/editor-curve-surface.css?inline";
import editorTokensCssText from "../../../ui/shared/editor-tokens.css?inline";
import definition from "../state";
import crusherEditorCssText from "./crusher-editor.css?inline";
import editorTickSliderCssText from "./editor-tick-slider.css?inline";
import { SeqFxPatchView } from "./SeqFxPatchView";
import { createDefaultSeqFxState } from "./seqfx-state";
import { useSeqFxSession } from "./seqfx-session";
import stutterEnvelopeEditorCssText from "./stutter-envelope-editor.css?inline";
import seqFxCssText from "./styles.css?inline";

const css = [
    editorTokensCssText,
    editorCurveSurfaceCssText,
    editorTickSliderCssText,
    crusherEditorCssText,
    stutterEnvelopeEditorCssText,
    seqFxCssText,
].join("\n");

/** Shown until the patterns and global controls have their values, or when they cannot be read. */
function SeqFxStatus() {
    const patterns = usePluginState(definition.patterns);
    if (patterns.state.status === "invalid") {
        return (
            <section className="seqfx-status" role="alert">
                <p>{patterns.error?.message}</p>
                <button type="button" onClick={() => { void patterns.setValue(createDefaultSeqFxState()); }}>
                    Start with empty patterns
                </button>
            </section>
        );
    }
    if (patterns.state.status === "unavailable") {
        return <p className="seqfx-status" role="alert">{patterns.error?.message ?? "SeqFX cannot reach its state."}</p>;
    }
    return <p className="seqfx-status" role="status">Connecting</p>;
}

function View() {
    const session = useSeqFxSession();
    return session ? <SeqFxPatchView session={session} /> : <SeqFxStatus />;
}

export default createStatefulPatchView({ definition, View, css });
