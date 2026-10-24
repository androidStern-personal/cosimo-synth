import { createRoot } from "react-dom/client";
import {
    definePluginState, parameter, storedValue, presets, snapshots, usePresets, useSnapshots, usePluginState, usePluginHistory,
    PresetBar, SnapshotBar,
    type PluginStateControl, type PluginStateHistory, type Presets, type Snapshots,
} from "../../index";
import { PatchConnectionProvider } from "../../ui/cmajor-react";
import { PluginStateProvider } from "../../ui/plugin-state-react";
import { createPluginStateClient, type PluginStateClientEvent } from "../../ui/plugin-state-client";
import { createPluginStateSession } from "../../ui/plugin-state-session";
import { syncUserLifetimeFields } from "../../ui/plugin-state-user-files";

const modeCodec = {
    parse: (input: unknown) => input === "clean" || input === "warm"
        ? { kind: "ok" as const, value: input } : { kind: "error" as const, message: "Expected clean or warm." },
    encode: (value: "clean" | "warm") => value,
    equals: (left: string, right: string) => left === right,
};
/** `initial` names the factory preset a fresh project starts on. */
const harnessState = (initial?: string) => definePluginState({
    gain: parameter("gainIn"),
    mode: storedValue<"clean" | "warm">({ initial: "clean", codec: modeCodec }),
    ...presets({ factory: [
        { id: "init", name: "Init", values: { gain: 0, mode: "clean" } },
        { id: "quiet", name: "Quiet", values: { gain: -12, mode: "clean" } },
        { id: "hot", name: "Hot", values: { gain: 6, mode: "warm" } },
    ], initial }),
    ...snapshots({ slots: ["A", "B", "C"] }),
});
export const pluginId = "com.example.presets";

type Latest = { presets: Presets; snapshots: Snapshots; history: PluginStateHistory; gain: PluginStateControl<number>; mode: PluginStateControl<"clean" | "warm"> };

/** The real owner, client and React hooks for one definition with presets and snapshots. */
export async function mount(element: HTMLElement, initial?: string) {
    const definition = harnessState(initial);
    const scope = { owner: "presets-owner", document: 0 };
    const defects: unknown[] = [];
    const jobs: Promise<unknown>[] = [];
    let receive: ((event: PluginStateClientEvent<ReturnType<typeof harnessState>>) => void) | undefined;
    let latest: Latest | undefined;
    const owner = createPluginStateSession(definition, {
        native: { publish() {}, close() {}, update(state, receipt) {
            receive?.({ kind: "update", scope, revision: state.revision, state, ...(receipt ? { receipt } : {}) });
        } }, onDefect: error => defects.push(error),
    });
    await owner.dispatch({ kind: "opened", scope, native: { values: {}, parameters: [
        { endpoint: "gainIn", value: 0, min: -24, max: 24, step: 0, defaultValue: 0 },
    ] } });
    const client = createPluginStateClient(definition, { channel: {
        subscribe(listener) { receive = listener; return () => { receive = undefined; }; },
        send(message) {
            if (message.kind === "attach") {
                const state = owner.getSnapshot();
                receive?.({ kind: "attached", request: message.request, scope, client: 1, revision: state.revision, state });
            } else jobs.push(owner.dispatch({ kind: "command", address: { ...message.scope, client: message.client, sequence: message.sequence }, command: message.command }));
        },
    }, onDefect: error => defects.push(error) });
    const stopUserFiles = syncUserLifetimeFields(definition, client, pluginId, error => defects.push(error));
    function Harness() {
        latest = { presets: usePresets(definition), snapshots: useSnapshots(definition), history: usePluginHistory(),
            gain: usePluginState(definition.gain), mode: usePluginState(definition.mode) };
        return <><PresetBar definition={definition} /><SnapshotBar definition={definition} /></>;
    }
    const root = createRoot(element);
    root.render(<PatchConnectionProvider patchConnection={{ manifest: { ID: pluginId } }}>
        <PluginStateProvider definition={definition} client={client}><Harness /></PluginStateProvider>
    </PatchConnectionProvider>);
    const snapshotSlots = () => {
        const field = owner.getSnapshot().fields.snapshotSlots;
        return "value" in field ? field.value : null;
    };
    const current = () => { if (!latest) throw new Error("The harness has not rendered."); return latest; };
    const rendered = () => new Promise(resolve => setTimeout(resolve, 20));
    return {
        /** A plain summary of everything the tests assert on. */
        view() {
            const { presets, snapshots, history, gain, mode } = current();
            return {
                status: presets.status, error: presets.error, active: presets.active, dirty: presets.dirty,
                user: presets.user.map(({ name }) => name), factory: presets.factory.map(({ name }) => name),
                slots: snapshots.slots, activeSlot: snapshots.active, canUndo: history.canUndo,
                gain: "value" in gain.state ? gain.state.value : null, mode: "value" in mode.state ? mode.state.value : null,
                slotContents: snapshotSlots(),
            };
        },
        /** Run one action through the latest render, then wait for the next render. */
        async run(group: "presets" | "snapshots" | "gain" | "mode" | "history", action: string, ...args: unknown[]) {
            const target = current()[group] as unknown as Record<string, (...input: unknown[]) => unknown>;
            const result = await target[action]?.(...args);
            await rendered();
            return result;
        },
        exportJson: (id?: string) => current().presets.exportJson(id),
        defects: () => defects.map(String),
        async dispose() { root.unmount(); stopUserFiles(); client.stop(); await Promise.all(jobs); await owner.stop(); },
    };
}
