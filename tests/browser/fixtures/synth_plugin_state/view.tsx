import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { SynthStateProvider, useSynthPluginParameterBinding } from "../../../../ui/shared/synth-plugin-state-react";
import { synthPluginState } from "../../../../ui/shared/synth-plugin-state";
import { createCmajorPluginStateService } from "../../../../kit/ui/plugin-state-cmajor";
import { usePluginHistory } from "../../../../kit/index";
import { createPluginStateTestPlatform } from "../../../helpers/plugin_state_test_platform.mjs";

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
        <button onClick={() => globalTune.beginGesture()}>Begin tune</button>
        <button onClick={() => globalTune.setValue(5)}>Drag five</button>
        <button onClick={() => globalTune.setValue(7)}>Drag seven</button>
        <button onClick={() => globalTune.endGesture()}>End tune</button>
        <button disabled={!history.canUndo} onClick={() => history.undo()}>Undo</button>
        <button disabled={!history.canRedo} onClick={() => history.redo()}>Redo</button>
    </>;
}

// The constructor is supplied from the actual pinned Cmajor browser module.
export async function mount(element: HTMLElement, Channel: unknown) {
    const platform = createPluginStateTestPlatform(Channel, { holdOpen: true, parameters: [
        { endpoint: "playMode", value: 1, min: 0, max: 2, step: 1, defaultValue: 0 },
        { endpoint: "glideTime", value: 0.15, min: 0, max: 2, step: 0, defaultValue: 0 },
        { endpoint: "globalTune", value: -7.5, min: -24, max: 24, step: 0.01, defaultValue: 0 },
    ] });
    const defects: string[] = [];
    const owner = createCmajorPluginStateService(synthPluginState, platform.worker, { onDefect: error => defects.push(String(error)) });
    const starting = owner.start();
    const view = platform.createView();
    const root = createRoot(element);
    flushSync(() => root.render(<SynthStateProvider patchConnection={view}><Controls /></SynthStateProvider>));
    return {
        async releaseBoot() { platform.releaseOpen(); await starting; },
        publications: platform.publications,
        messages: view.messages,
        parameter: platform.parameter,
        defects: () => [...defects],
        async dispose() { root.unmount(); platform.removeView(view); platform.releaseOpen(); await starting; await owner.stop(); },
    };
}
