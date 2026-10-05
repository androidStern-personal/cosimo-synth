import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { usePluginHistory, usePluginState } from "../../kit/index";
import { PatchConnectionProvider } from "../../ui/shared/cmajor-react";
import { MockPatchConnection, loadHarnessManifest } from "../../ui/shared/patch-connection-mock";
import { SILENT_POLISH_METER_FRAME } from "../../ui/shared/polish";
import { SynthPresetBar } from "../../ui/shared/synth-preset-bar";
import { synthParameterByEndpoint } from "../../ui/shared/synth-plugin-state";
import { SynthStateProvider } from "../../ui/shared/synth-plugin-state-react";

/** A user edit through the state framework, so it is an Undo entry like a knob turn. */
function Edits() {
    const cutoff = usePluginState(synthParameterByEndpoint.filterCutoff!);
    const history = usePluginHistory();
    const set = async (value: number) => {
        await cutoff.beginGesture();
        void cutoff.setValue(value);
        await cutoff.endGesture();
    };
    return <>
        <button onClick={() => { void set(2400); }}>Cutoff 2400</button>
        <button onClick={() => { void set(600); }}>Cutoff 600</button>
        <button disabled={!history.canUndo} onClick={() => { void history.undo(); }}>Undo</button>
        <button disabled={!history.canRedo} onClick={() => { void history.redo(); }}>Redo</button>
    </>;
}

/** Mount the synth preset row on the development patch connection. */
export async function mount(element: HTMLElement, options: { readonly compact: boolean }) {
    const connection = new MockPatchConnection(await loadHarnessManifest());
    const calls = { replaced: [] as Record<string, number>[], bounceAudio: 0, videoPatches: [] as unknown[], developerSettings: 0, back: 0 };
    // Every selector slot holds a shipped factory table, so the default sound can be shared.
    const tables = Array.from({ length: 239 }, (_, index) => ({ tableId: `factory-${index}` }));
    const root = createRoot(element);
    flushSync(() => root.render(<PatchConnectionProvider patchConnection={connection}>
        <SynthStateProvider patchConnection={connection}>
            <SynthPresetBar compact={options.compact} backAvailable onBack={() => { calls.back += 1; }}
                polishMeter={SILENT_POLISH_METER_FRAME} wavetableTables={tables}
                bounceAudioAvailable onBounceAudio={() => { calls.bounceAudio += 1; }}
                videoBounceAvailable onBounceVideo={patch => { calls.videoPatches.push(patch); }}
                developerSettingsAvailable onOpenDeveloperSettings={() => { calls.developerSettings += 1; }}
                onSoundReplaced={parameters => { calls.replaced.push({ ...parameters }); }} />
            <Edits />
        </SynthStateProvider>
    </PatchConnectionProvider>));
    return {
        calls: () => structuredClone(calls),
        parameter: (endpointID: string) => Number(connection.getDebugSnapshot().parameterValues[endpointID]),
        storedState: (key: string) => connection.getDebugSnapshot().storedState[key],
        dispose() { root.unmount(); },
    };
}
