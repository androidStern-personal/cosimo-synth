import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { PatchConnectionProvider } from "../../../../kit/ui/cmajor-react";
import { usePluginHistory, usePluginState } from "../../../../kit/index";
import { SynthStateProvider } from "../../../../ui/shared/synth-plugin-state-react";
import { usePatchParameterBinding } from "../../../../ui/shared/patch-controls";
import { synthPluginState } from "../../../../ui/shared/synth-plugin-state";
import { MODULATION_STATE_KEY } from "../../../../ui/shared/modulation";
import { MockPatchConnection, loadHarnessManifest } from "../../../../ui/shared/patch-connection-mock";
import { subscribeToUserEdits } from "../../../../ui/shared/user-edit-bus";

/** Only native parameter storage/DSP are modeled by the real development host.
 * Actual public React controls, client, channel, owner and history are exercised. */
export async function mount(element: HTMLElement) {
    const connection = new MockPatchConnection(await loadHarnessManifest());
    connection.setParameterValue("filterCutoff", 8000);
    connection.deferParameterResponse("filterCutoff");
    const edits: unknown[] = [];
    const stopEdits = subscribeToUserEdits({ onGestureStart: () => edits.push({ kind: "begin" }),
        onGestureEnd: () => edits.push({ kind: "end" }), onParameterEdit: value => edits.push({ kind: "edit", ...value }) });
    let root: ReturnType<typeof createRoot> | undefined;
    function Controls() {
        const cutoff = usePatchParameterBinding({ endpointID: "filterCutoff", initialValue: 123, coerce: Number });
        const table = usePatchParameterBinding({ endpointID: "oscAWavetableSelect", initialValue: 0, coerce: Number });
        const detune = usePatchParameterBinding({ endpointID: "oscAUnisonDetune", initialValue: 0.1, coerce: Number,
            presentationPriority: "deferred-during-gesture" });
        const inactive = usePatchParameterBinding({ endpointID: "macro4", initialValue: 0, coerce: Number, active: false });
        usePatchParameterBinding({ endpointID: "inactive-lane-record", initialValue: 0, coerce: Number, active: false });
        const modulation = usePluginState(synthPluginState[MODULATION_STATE_KEY]);
        const history = usePluginHistory();
        const controls = { cutoff, table, detune, inactive, modulation, history };
        latest = controls;
        return <output data-testid="ordinary-state">{JSON.stringify({
            cutoff, table, detune, inactive, modulation: modulation.state,
            history: { canUndo: history.canUndo, canRedo: history.canRedo },
        })}</output>;
    }
    type Bindings = {
        cutoff: ReturnType<typeof usePatchParameterBinding<number>>;
        table: ReturnType<typeof usePatchParameterBinding<number>>;
        detune: ReturnType<typeof usePatchParameterBinding<number>>;
        inactive: ReturnType<typeof usePatchParameterBinding<number>>;
        modulation: ReturnType<typeof usePluginState<typeof synthPluginState[typeof MODULATION_STATE_KEY]>>;
        history: ReturnType<typeof usePluginHistory>;
    };
    let latest: Bindings;
    const open = () => {
        root = createRoot(element);
        flushSync(() => root!.render(<PatchConnectionProvider patchConnection={connection}>
            <SynthStateProvider patchConnection={connection}><Controls /></SynthStateProvider>
        </PatchConnectionProvider>));
    };
    open();
    return {
        releaseBoot: () => connection.releaseParameterResponse("filterCutoff"),
        snapshot: () => connection.getDebugSnapshot(),
        edits: () => [...edits],
        automate: (endpoint: string, value: number) => connection.setParameterValue(endpoint, value),
        begin: (key: "cutoff" | "detune") => latest[key].beginGesture(),
        set(key: "cutoff" | "detune", value: number) { flushSync(() => latest[key].setValue(value)); },
        end: (key: "cutoff" | "detune") => latest[key].endGesture(),
        commit: (key: "cutoff" | "table" | "inactive", value: number) => latest[key].commitValue(value),
        shape(value: number) {
            if (latest.modulation.state.kind !== "ready") throw new Error("Modulation is not ready");
            const bank = latest.modulation.state.value;
            return latest.modulation.setValue({ ...bank, msegSlots: bank.msegSlots.map((slot, index) => index !== 0 ? slot : {
                ...slot, shapeA: { ...slot.shapeA, points: slot.shapeA.points.map(point => ({ ...point, y: value })) },
            }) });
        },
        undo: () => latest.history.undo(), redo: () => latest.history.redo(),
        reopen() { root?.unmount(); open(); },
        dispose() { root?.unmount(); stopEdits();  },
    };
}
