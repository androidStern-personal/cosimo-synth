import { createStatefulPatchView, usePluginState, usePluginHistory } from "../../kit/index";
import definition from "./state";
// Framework/agent fixture integration uses the adapter constructor. This is
// separate from the author's public view/hooks and is not an MCP API.
import { createCmajorPluginStateClient } from "../../kit/ui/plugin-state-cmajor";

export const outcomes: unknown[] = [];
export const defects: string[] = [];
const record = (operation: Promise<unknown> | undefined) => { void operation?.then(result => outcomes.push(result)); };
function View() {
    const gain = usePluginState(definition.gain);
    const curve = usePluginState(definition.curve);
    const history = usePluginHistory();
    return <>
        <output data-testid="gain">{JSON.stringify(gain.state)}</output>
        <output data-testid="curve">{JSON.stringify(curve.state)}</output>
        <output data-testid="history">{JSON.stringify({ canUndo: history.canUndo, canRedo: history.canRedo })}</output>
        <button onClick={() => record(curve.beginGesture())}>Begin curve</button>
        <button onClick={() => record(curve.setValue({ points: [0, 0.4, 1] }))}>Curve four</button>
        <button onClick={() => record(curve.setValue({ points: [0, 0.8, 1] }))}>Curve eight</button>
        <button onClick={() => record(curve.endGesture())}>End curve</button>
        <button onClick={() => record(gain.beginGesture())}>Begin gain</button>
        <button onClick={() => record(gain.endGesture())}>End gain</button>
        <button onClick={() => record(gain.setValue(5.5))}>Gain five</button>
        <button onClick={() => record(history.undo())}>Undo</button>
        <button onClick={() => record(history.redo())}>Redo</button>
    </>;
}
export default createStatefulPatchView({ definition, View });
export const createAgent = connection => createCmajorPluginStateClient(definition, connection, { onDefect: error => defects.push(String(error)) });
