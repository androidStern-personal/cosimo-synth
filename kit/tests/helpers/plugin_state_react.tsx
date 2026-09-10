import { useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { definePluginState, parameter } from "../../ui/plugin-state-definition";
import { createPluginStateClient, type PluginStateClientEvent, type PluginStateClientMessage } from "../../ui/plugin-state-client";
import { PluginStateProvider, usePluginState, usePluginHistory } from "../../ui/plugin-state-react";

const definition = definePluginState({ gain: parameter("gain") });
const sent: PluginStateClientMessage[] = [];
const listeners = new Set<(event: PluginStateClientEvent<typeof definition>) => void>();
const defects: unknown[] = [];
const client = createPluginStateClient(definition, {
    channel: {
        subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
        send(message) { sent.push(structuredClone(message)); },
    },
    onDefect(error) { defects.push(String(error)); },
});

// This fixture controls the parsed channel seam only. It never applies edits,
// assigns versions, groups history, or pretends to be the native runtime.
export function deliver(event: PluginStateClientEvent<typeof definition>) {
    // Commit this delivery's actual React updates before the test reads the DOM.
    // Otherwise a pre-delivery value could accidentally satisfy a late-reply check.
    flushSync(() => { for (const listener of listeners) listener(structuredClone(event)); });
}
export function messages() { return { sent, defects }; }

function Knob() {
    const gain = usePluginState(definition.gain);
    return <div>
        <output data-testid="gain">{JSON.stringify(gain.state)}</output>
        <button onClick={() => gain.beginGesture()}>Begin</button>
        <button onClick={() => gain.setValue(4)}>Set four</button>
        <button onClick={() => gain.setValue(7)}>Set seven</button>
        <button onClick={() => gain.endGesture()}>End</button>
    </div>;
}
function View() {
    const [show, setShow] = useState(true);
    const history = usePluginHistory();
    return <>
        {show && <Knob />}
        <button onClick={() => setShow(value => !value)}>Toggle control</button>
        <button disabled={!history.canUndo} onClick={() => history.undo()}>Undo</button>
        <button disabled={!history.canRedo} onClick={() => history.redo()}>Redo</button>
    </>;
}
export function mount(element: HTMLElement) {
    const root = createRoot(element);
    root.render(<PluginStateProvider definition={definition} client={client}><View /></PluginStateProvider>);
    return () => { root.unmount(); client.stop(); };
}
