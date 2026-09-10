import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { SynthStateProvider, useSynthPluginParameterBinding } from "../../../../ui/shared/synth-plugin-state-react";
import { synthPluginState } from "../../../../ui/shared/synth-plugin-state";
import { createCmajorPluginStateClient, createCmajorPluginStateService } from "../../../../kit/ui/plugin-state-cmajor";
import type { PluginStateCommand } from "../../../../kit/ui/plugin-state-session";
import { usePluginHistory } from "../../../../kit/index";
import { createPluginStateTestPlatform } from "../../../helpers/plugin_state_test_platform.mjs";
import { runProgrammaticWrites, subscribeToUserEdits } from "../../../../ui/shared/user-edit-bus";
import { MockPatchConnection, loadHarnessManifest } from "../../../../ui/shared/patch-connection-mock";

const coerce = (value: unknown) => Number(value);
function Controls() {
    const playMode = useSynthPluginParameterBinding("playMode", { initialValue: 99, coerce });
    const glideTime = useSynthPluginParameterBinding("glideTime", { initialValue: 99, coerce });
    const globalTune = useSynthPluginParameterBinding("globalTune", { initialValue: 99, coerce });
    const history = usePluginHistory();
    return <>
        <output data-testid="playMode">{JSON.stringify(playMode)}</output>
        <output data-testid="glideTime">{JSON.stringify(glideTime)}</output>
        <output data-testid="globalTune">{JSON.stringify(globalTune)}</output>
        <output data-testid="history">{JSON.stringify({ canUndo: history.canUndo, canRedo: history.canRedo })}</output>
        <button onClick={() => globalTune.commitValue(5)}>Tune five</button>
        <button onClick={() => playMode.commitValue(2)}>Play two</button>
        <button onClick={() => glideTime.commitValue(0.5)}>Glide half</button>
        <button onClick={() => runProgrammaticWrites(() => glideTime.commitValue(0.5))}>Programmatic glide</button>
        <button onClick={() => globalTune.beginGesture()}>Begin tune</button>
        <button onClick={() => globalTune.setValue(5)}>Drag five</button>
        <button onClick={() => globalTune.setValue(7)}>Drag seven</button>
        <button onClick={() => globalTune.endGesture()}>End tune</button>
        <button onClick={() => { globalTune.beginGesture(); globalTune.setValue(7); globalTune.endGesture(); }}>Complete tune</button>
        <button disabled={!history.canUndo} onClick={() => history.undo()}>Undo</button>
        <button disabled={!history.canRedo} onClick={() => history.redo()}>Redo</button>
    </>;
}

/** Exercise the development connection itself, including its legacy raw-write paths. */
export async function mountMock(element: HTMLElement) {
    const connection = new MockPatchConnection(await loadHarnessManifest());
    connection.setParameterValue("globalTune", -7.5);
    const root = createRoot(element);
    flushSync(() => root.render(<SynthStateProvider patchConnection={connection}><Controls /></SynthStateProvider>));
    return {
        rawWrite(endpoint: string, value: number) { connection.sendEventOrValue(endpoint, value); },
        automate(endpoint: string, value: number) { connection.setParameterValue(endpoint, value); },
        hostGestureWrite(endpoint: string, value: number) {
            connection.sendParameterGestureStart(endpoint);
            connection.sendEventOrValue(endpoint, value);
            connection.sendParameterGestureEnd(endpoint);
        },
        hostUndo: () => connection.undoLastParameterTransaction(),
        snapshot: () => connection.getDebugSnapshot(),
        dispose() { root.unmount(); },
    };
}

// The constructor is supplied from the actual pinned Cmajor browser module.
export async function mount(element: HTMLElement, Channel: unknown) {
    const platform = createPluginStateTestPlatform(Channel, { holdOpen: true, parameters: [
        { endpoint: "playMode", value: 1, min: 0, max: 2, step: 1, defaultValue: 0 },
        { endpoint: "glideTime", value: 0.15, min: 0, max: 2, step: 0, defaultValue: 0 },
        { endpoint: "globalTune", value: -7.5, min: -24, max: 24, step: 0.01, defaultValue: 0 },
    ] });
    const defects: string[] = [];
    const edits: unknown[] = [];
    const stopEdits = subscribeToUserEdits({
        onGestureStart: () => edits.push({ kind: "begin" }),
        onGestureEnd: () => edits.push({ kind: "end" }),
        onParameterEdit: edit => edits.push({ kind: "edit", ...edit }),
    });
    const owner = createCmajorPluginStateService(synthPluginState, platform.worker, { onDefect: error => defects.push(String(error)) });
    const starting = owner.start();
    const view = platform.createView();
    let root: ReturnType<typeof createRoot> | undefined;
    let observer: ReturnType<typeof createCmajorPluginStateClient<typeof synthPluginState>> | undefined;
    let observerView: ReturnType<typeof platform.createView> | undefined;
    const render = () => {
        root = createRoot(element);
        flushSync(() => root?.render(<SynthStateProvider patchConnection={view}><Controls /></SynthStateProvider>));
    };
    render();
    return {
        async releaseBoot() { platform.releaseOpen(); await starting; },
        publications: platform.publications,
        messages: view.messages,
        holdReplies: view.holdIncoming,
        releaseReplies: view.releaseIncoming,
        queuedReplies: view.queuedMessages,
        parameter: platform.parameter,
        automate: platform.automate,
        edits: () => [...edits],
        openObserver() {
            observerView = platform.createView();
            observer = createCmajorPluginStateClient(synthPluginState, observerView, { onDefect: error => defects.push(String(error)) });
        },
        observerState: () => observer?.getSnapshot(),
        observerCommand(command: PluginStateCommand) {
            if (!observer) throw new Error("Open the independent client before dispatching");
            return observer.dispatch(command);
        },
        unmountView() { root?.unmount(); root = undefined; },
        remountView: render,
        defects: () => [...defects],
        async dispose() {
            root?.unmount(); observer?.stop();
            if (observerView) platform.removeView(observerView);
            stopEdits(); platform.removeView(view); platform.releaseOpen(); await starting; await owner.stop();
        },
    };
}
