// Spectral Chord Resonator's editor. Edit it live with `npm run fx:dev`; `npm run fx:build -- spectral` bundles it.
import { createStatefulPatchView, PresetBar, SnapshotBar, usePatchConnection, usePluginHistory } from "../../../kit/index";
import { ControlGroups, stockControlsOf } from "../../../ui/shared/stock-controls-view";
import definition from "../state";
import { PartialEditor } from "./partial-editor";
import css from "./spectral.css?inline";

function View() {
    const history = usePluginHistory();
    const controls = stockControlsOf(usePatchConnection());
    return <div className="spectral">
        <header className="plugin-header">
            <PresetBar definition={definition} />
            <SnapshotBar definition={definition} />
            <nav aria-label="Edit history" className="history-controls">
                <button type="button" disabled={!history.canUndo} onClick={() => { void history.undo(); }}>Undo</button>
                <button type="button" disabled={!history.canRedo} onClick={() => { void history.redo(); }}>Redo</button>
            </nav>
        </header>
        {controls && <style>{controls.getAllCSS()}</style>}
        <div className="frame">
            <PartialEditor />
            <div className="frame-groups">
                {controls
                    ? <ControlGroups controls={controls} definition={definition} />
                    : <section className="empty" role="alert">This host does not provide Cmajor's parameter controls.</section>}
            </div>
        </div>
    </div>;
}

export default createStatefulPatchView({ definition, View, css });
