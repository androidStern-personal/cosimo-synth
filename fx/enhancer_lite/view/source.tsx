// Enhance That's editor. Edit it live with `npm run fx:dev`; `npm run fx:build -- enhancer-lite` bundles it.
import { useId } from "react";
import { createStatefulPatchView, usePluginHistory, PresetBar, SnapshotBar,
    type BrowserPreviewParameter, type PluginStateControl } from "../../../kit/index";
import definition from "../state";
import css from "./enhance-that.css?inline";
import * as band from "./quantities";
import { Readout } from "./readout";
import { ResponseGraph } from "./response-graph";
import { useSound } from "./sound";

/** The DSP's eight sound parameters, for the silent browser preview. */
export const browserPreviewParameters = [
    { endpointID: "freqHzIn", type: "number", min: band.frequency.min, max: band.frequency.max, defaultValue: 130 },
    { endpointID: "qIn", type: "number", min: band.q.min, max: band.q.max, defaultValue: 0.71 },
    { endpointID: "modeIn", type: "integer", min: 0, max: 1, defaultValue: 0, discrete: true, step: 1, text: "Stereo|Mid/Side" },
    { endpointID: "midAmountIn", type: "number", min: band.amount.min, max: band.amount.max, defaultValue: 0 },
    { endpointID: "sideAmountIn", type: "number", min: band.amount.min, max: band.amount.max, defaultValue: 0 },
    { endpointID: "curveIn", type: "integer", min: 0, max: 1, defaultValue: 1, discrete: true, step: 1, text: "Tube|Solid" },
    { endpointID: "saturationModeIn", type: "integer", min: 0, max: 1, defaultValue: 0, discrete: true, step: 1, text: "Subtle|Medium" },
    { endpointID: "shapeIn", type: "integer", min: 0, max: 2, defaultValue: 1, discrete: true, step: 1, text: "Low|Bell|High" },
] satisfies BrowserPreviewParameter[];

/** A row of buttons that selects one of a choice parameter's values. */
function Choice({ label, options, control, value }: {
    readonly label: string; readonly options: readonly string[]; readonly control: PluginStateControl<number>; readonly value: number;
}) {
    const labelId = useId();
    return <div className="choice" role="group" aria-labelledby={labelId}>
        <span id={labelId} className="choice-label">{label}</span>
        <div className="segmented">
            {options.map((option, index) => <button key={option} type="button" aria-pressed={Math.round(value) === index}
                onClick={() => { if (Math.round(value) !== index) void control.setValue(index); }}>{option}</button>)}
        </div>
    </div>;
}

function View() {
    const history = usePluginHistory();
    const { controls, sound } = useSound();
    const errors = Object.entries(controls).flatMap(([key, control]) => control.error ? [{ key, message: control.error.message }] : []);
    const unavailable = Object.values(controls).some(control => control.state.status === "invalid" || control.state.status === "unavailable");
    const midSide = sound !== null && sound.routing >= 0.5;
    return <div className="enhance-that">
        <header className="plugin-header">
            <PresetBar definition={definition} />
            <SnapshotBar definition={definition} />
            <nav aria-label="Edit history" className="history-controls">
                <button type="button" disabled={!history.canUndo} onClick={() => { void history.undo(); }}>Undo</button>
                <button type="button" disabled={!history.canRedo} onClick={() => { void history.redo(); }}>Redo</button>
            </nav>
        </header>
        {errors.map(({ key, message }) => <p key={key} role="alert">{message}</p>)}
        {sound === null ? <p role="status">{unavailable ? "Controls unavailable" : "Connecting"}</p> : <main className="shell">
            <header className="topline">
                <div>
                    <h1>Enhance That</h1>
                    <div className="tag">ONE BAND // STEREO + M/S</div>
                </div>
                <div className="engine-label">4X IIR // FAST CURVE</div>
            </header>
            <ResponseGraph sound={sound} controls={controls} />
            <div className="control-deck">
                <div className="readouts">
                    <Readout label="Frequency" caption="FREQ" quantity={band.frequency} control={controls.frequency} value={sound.frequency} orientation="horizontal" />
                    <Readout label={midSide ? "Mid Amount" : "Amount"} caption={midSide ? "MID" : "AMOUNT"} quantity={band.amount}
                        control={controls.amount} value={sound.amount} orientation="vertical" tone="mid" />
                    {midSide && <Readout label="Side Amount" caption="SIDE" quantity={band.amount} control={controls.sideAmount}
                        value={sound.sideAmount} orientation="vertical" tone="side" />}
                    <Readout label="Q" caption="Q" quantity={band.q} control={controls.q} value={sound.q} orientation="vertical" />
                </div>
                <div className="choices">
                    <Choice label="Shape" options={["Low", "Bell", "High"]} control={controls.shape} value={sound.shape} />
                    <Choice label="Route" options={["Stereo", "M/S"]} control={controls.routing} value={sound.routing} />
                    <Choice label="Character" options={["Tube", "Solid"]} control={controls.character} value={sound.character} />
                    <Choice label="Intensity" options={["Subtle", "Medium"]} control={controls.intensity} value={sound.intensity} />
                </div>
            </div>
        </main>}
    </div>;
}

export default createStatefulPatchView({ definition, View, css });
