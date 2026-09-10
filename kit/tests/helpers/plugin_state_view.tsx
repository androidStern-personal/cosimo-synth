import { createStatefulPatchView, definePluginState, parameter, usePluginState, usePatchConnection } from "../../index";
import { flushSync } from "react-dom";

const definition = definePluginState({ gain: parameter("gain") });
const sent: unknown[] = [];
const trace: string[] = [];
const listeners = new Set<(body: unknown) => void>();
const connection = {
    marker: "real-context",
    addEventListener(_type: "kit_state", listener: (body: unknown) => void) { trace.push("subscribe"); listeners.add(listener); },
    removeEventListener(_type: "kit_state", listener: (body: unknown) => void) { trace.push("unsubscribe"); listeners.delete(listener); },
    sendMessageToServer(body: unknown) {
        const message = JSON.parse(JSON.stringify(body)).message;
        trace.push(`send:${message.command?.kind ?? message.kind}`);
        sent.push(structuredClone(body));
    },
};
function View() {
    const gain = usePluginState(definition.gain);
    const host = usePatchConnection();
    return <>
        <output data-testid="wrapped">{JSON.stringify({ ...gain.state, correctConnection: host === connection })}</output>
        <button onClick={() => gain.beginGesture()}>Wrapped begin</button>
        <button onClick={() => gain.setValue(4)}>Wrapped four</button>
        <button onClick={() => gain.setValue(7)}>Wrapped seven</button>
    </>;
}
const factory = createStatefulPatchView({ definition, View, css: "button { color: rgb(12, 34, 56); }" });
let element: HTMLElement;
export function create() { element = factory(connection); }
export function append() { document.getElementById("mount")!.append(element); }
export function remove() { element.remove(); }
export function messages() { return { sent, listeners: listeners.size, trace }; }
export function deliver(body: unknown) { flushSync(() => { for (const listener of listeners) listener(structuredClone(body)); }); }
export function createSecond() {
    const secondFactory = createStatefulPatchView({ definition, View: () => <><span>Second configured view</span><View /></> });
    element = secondFactory(connection);
}
