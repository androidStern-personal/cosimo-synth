import { createCmajorPluginStateClient, type CmajorStateConnection } from "../../kit/ui/plugin-state-cmajor";
import { synthPluginState } from "./synth-plugin-state";

type SynthStateClient = ReturnType<typeof createCmajorPluginStateClient<typeof synthPluginState>>;
type Entry = { readonly client: SynthStateClient; leases: number };
const clients = new WeakMap<CmajorStateConnection, Entry>();

/** One GUI client shared by the synth's view, controls, and imperative adapters. */
export function acquireSynthViewState(connection: CmajorStateConnection): {
    readonly client: SynthStateClient;
    release(): void;
} {
    let entry = clients.get(connection);
    const state = entry?.client.getSnapshot();
    if (!entry || state?.kind === "closed" || state?.kind === "failed") {
        entry?.client.stop();
        entry = { client: createCmajorPluginStateClient(synthPluginState, connection, {
            onDefect: error => console.error("Cosimo state failed", error),
        }), leases: 0 };
        clients.set(connection, entry);
    }
    const owned = entry;
    owned.leases++;
    let released = false;
    return {
        client: owned.client,
        release() {
            if (released) return;
            released = true;
            if (--owned.leases !== 0) return;
            if (clients.get(connection) === owned) clients.delete(connection);
            owned.client.stop();
        },
    };
}
