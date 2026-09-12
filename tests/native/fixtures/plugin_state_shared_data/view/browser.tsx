// PLUGIN GUI: only the public state controls and shared Undo are used here.
import { createStatefulPatchView, usePluginState, usePluginHistory, Mseg } from "../../../kit/index";
import definition from "../state";
// Test inspection uses the framework client as a second, independent GUI.
import { createCmajorPluginStateClient } from "../../../kit/ui/plugin-state-cmajor";
export const outcomes: unknown[] = [];
export const defects: string[] = [];
const record = (promise: Promise<unknown> | undefined) => { void promise?.then(result => outcomes.push(result)); };
function View() {
    const shape = usePluginState(definition.shape);
    const gain = usePluginState(definition.gain);
    const loaded = usePluginState(definition.loaded);
    const history = usePluginHistory();
    const edit = (y: number) => {
        if (shape.state.kind === "ready") record(shape.setValue(Mseg.movePoint(shape.state.value, 1, 1, y)));
    };
    return <>
        {shape.state.kind === "ready" ? <Mseg.Editor value={shape.state.value} onChange={value => record(shape.setValue(value))} onGestureStart={() => record(shape.beginGesture())} onGestureEnd={() => record(shape.endGesture())}/> : null}
        <output data-testid="shape">{JSON.stringify(shape.state)}</output>
        <output data-testid="gain">{JSON.stringify(gain.state)}</output>
        <output data-testid="loaded">{JSON.stringify(loaded.state)}</output>
        <button onClick={() => record(loaded.setValue("descending.json"))}>Load file</button>
        <output data-testid="history">{JSON.stringify({ canUndo: history.canUndo, canRedo: history.canRedo })}</output>
        <button onClick={() => record(shape.beginGesture())}>Begin</button>
        <button onClick={() => edit(0.25)}>Low</button>
        <button onClick={() => edit(0.75)}>High</button>
        <button onClick={() => record(shape.endGesture())}>End</button>
        <button onClick={() => record(gain.setValue(1.5))}>Gain</button>
        <button onClick={() => record(history.undo())}>Undo</button>
        <button onClick={() => record(history.redo())}>Redo</button>
    </>;
}
export default createStatefulPatchView({ definition, View });
export const createAgent = (connection: Parameters<typeof createCmajorPluginStateClient>[1]) =>
    createCmajorPluginStateClient(definition, connection, { onDefect: error => defects.push(String(error)) });
