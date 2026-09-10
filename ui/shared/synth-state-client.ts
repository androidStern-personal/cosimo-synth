import { createCmajorPluginStateClient, type CmajorStateConnection } from "../../kit/ui/plugin-state-cmajor";
import { synthPluginState } from "./synth-plugin-state";
import type { PatchConnectionLike } from "./cmajor-react";
import { createModulationStateClient } from "./modulation-client";

type SynthStateClient = ReturnType<typeof createCmajorPluginStateClient<typeof synthPluginState>>;
type Entry = { readonly client: SynthStateClient; readonly modulation: ReturnType<typeof createModulationStateClient>; leases: number };
const clients = new WeakMap<CmajorStateConnection, Entry>();

function hasChannel(connection: PatchConnectionLike | CmajorStateConnection): connection is CmajorStateConnection {
    return "addEventListener" in connection && typeof connection.addEventListener === "function"
        && "removeEventListener" in connection && typeof connection.removeEventListener === "function"
        && "sendMessageToServer" in connection && typeof connection.sendMessageToServer === "function";
}

function stop(entry: Entry) {
    // Try to queue the final end; authenticated detach still seals the routed
    // edits if end was queued or its reply was lost. Never await that reply.
    try { void entry.modulation.stop().catch(error => console.error("Cosimo state cleanup failed", error)); }
    finally { entry.client.stop(); }
}

/** One GUI client shared by the synth's view, controls, and imperative adapters. */
export function acquireSynthViewState(connection: PatchConnectionLike | CmajorStateConnection): {
    readonly client: SynthStateClient;
    readonly modulation: Entry["modulation"];
    release(): void;
} {
    if (!hasChannel(connection)) throw new Error("Cosimo controls require the current plugin state runtime.");
    let entry = clients.get(connection);
    const state = entry?.client.getSnapshot();
    if (!entry || state?.kind === "closed" || state?.kind === "failed") {
        if (entry) stop(entry);
        const client = createCmajorPluginStateClient(synthPluginState, connection, {
            onDefect: error => console.error("Cosimo state failed", error),
        });
        entry = { client, modulation: createModulationStateClient(client), leases: 0 };
        clients.set(connection, entry);
    }
    const owned = entry;
    owned.leases++;
    let released = false;
    return {
        client: owned.client,
        modulation: owned.modulation,
        release() {
            if (released) return;
            released = true;
            if (--owned.leases !== 0) return;
            if (clients.get(connection) === owned) clients.delete(connection);
            stop(owned);
        },
    };
}
