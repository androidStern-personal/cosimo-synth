import { createPluginStateClient, type PluginStateClientEvent } from "../../kit/ui/plugin-state-client";
import { createPluginStateSession } from "../../kit/ui/plugin-state-session";
import { definePluginState, parameter, storedValue } from "../../kit/ui/plugin-state-definition";
import { createDefaultModulationState } from "../../ui/shared/modulation";
import { modulationStateCodec } from "../../ui/shared/synth-modulation-state";
import { createModulationStateClient } from "../../ui/shared/modulation-client";
import type { MsegShape } from "../../ui/shared/mseg";
import { createMockPluginStateHost } from "../../ui/shared/mock-plugin-state-host";
import { GLOBAL_TUNE_INITIAL_SEMITONES, GLOBAL_TUNE_MIN_SEMITONES, GLOBAL_TUNE_MAX_SEMITONES } from "../../ui/shared/global-tune";

/** UI-only native storage fixture; the staged channel and actual service own state/history. */
export async function createModulationProjectionHost(values: Record<string, unknown>) {
    const stored = new Map(Object.entries(values));
    const writes: Array<{ key: string; value: unknown }> = [];
    const events: Array<{ endpointID: string; value: unknown }> = [];
    const counts = { added: 0, removed: 0, attached: 0, listeners: 0 };
    // Existing development-native Voice metadata. This fixture has no engine
    // binding, so it cannot stand in for DSP or worker runtime-install evidence.
    const parameters = [
        { endpoint: "playMode", value: 0, min: 0, max: 2, defaultValue: 0, step: 0 },
        { endpoint: "glideTime", value: 0, min: 0, max: 2, defaultValue: 0, step: 0 },
        { endpoint: "globalTune", value: GLOBAL_TUNE_INITIAL_SEMITONES, min: GLOBAL_TUNE_MIN_SEMITONES,
            max: GLOBAL_TUNE_MAX_SEMITONES, defaultValue: GLOBAL_TUNE_INITIAL_SEMITONES, step: 0 },
    ];
    const host = createMockPluginStateHost({
        async readParameter(endpoint) {
            const parameter = parameters.find(candidate => candidate.endpoint === endpoint);
            if (!parameter) throw new Error(`Unexpected fixture parameter ${endpoint}`);
            return parameter;
        },
        writeParameter() { throw new Error("This projection fixture does not edit native parameters"); },
        beginGesture() {}, endGesture() {}, onDefect(error) { throw error; },
        storedValues: { read: key => stored.get(key), write(key, value) { stored.set(key, value); writes.push({ key, value }); } },
    });
    await host.ready;
    const connection = {
        sendEventOrValue(endpointID: string, value: unknown) { events.push({ endpointID, value }); },
        addEventListener(...args: Parameters<typeof host.addEventListener>) { counts.added++; counts.listeners++; host.addEventListener(...args); },
        removeEventListener(...args: Parameters<typeof host.removeEventListener>) { counts.removed++; counts.listeners--; host.removeEventListener(...args); },
        sendMessageToServer(...args: Parameters<typeof host.sendMessageToServer>) {
            const body = args[0].message;
            if (typeof body === "object" && body !== null && "kind" in body && body.kind === "attach") counts.attached++;
            host.sendMessageToServer(...args);
        },
    };
    return { connection, counts, writes, events,
        replace(key: string, value: unknown) {
            if (!host.replaceStoredValue(key, () => { stored.set(key, value); })) throw new Error("Raw replacement was not routed");
        },
        stop: host.stop,
    };
}

/** External routing only: all acceptance, drafts and history use production modules. */
export async function createModulationEditorFixture(shape: MsegShape) {
    const definition = definePluginState({ "modulation.v6": storedValue({ initial: createDefaultModulationState(), codec: modulationStateCodec }),
        globalTune: parameter("globalTune") });
    const boot = createDefaultModulationState();
    boot.msegSlots[0].shapeA = shape;
    const scope = { owner: "browser-editor", document: 0 };
    type Event = PluginStateClientEvent<typeof definition>;
    const receivers = new Map<number, (event: Event) => void>();
    const jobs: Promise<unknown>[] = [];
    const held: Event[] = [];
    let holdEnd = false;
    let holdBegin = false;
    let holdUndo = false;
    const heldAddresses = new Set<string>();
    const session = createPluginStateSession(definition, { native: {
        publish() {}, close() {},
        update(state, receipt) {
            const holding = receipt && heldAddresses.has(`${receipt.address.client}:${receipt.address.sequence}`);
            if (holding) held.push({ kind: "receipt", address: receipt.address, result: receipt.result });
            for (const receive of receivers.values()) receive({ kind: "update", scope, revision: state.revision, state,
                ...(!holding && receipt ? { receipt } : {}) });
        },
    }, onDefect(error) { throw error; } });
    await session.dispatch({ kind: "opened", scope, native: { values: { "modulation.v6": JSON.stringify(boot) },
        parameters: [{ endpoint: "globalTune", value: 0, min: -12, max: 12, step: 0.5, defaultValue: 0 }] } });
    const createClient = (id: number) => createPluginStateClient(definition, { channel: {
        subscribe(receive) { receivers.set(id, receive); return () => receivers.delete(id); },
        send(message) {
            if (message.kind === "attach") {
                const state = session.getSnapshot();
                receivers.get(id)?.({ kind: "attached", request: message.request, scope, client: id, revision: state.revision, state });
            } else {
                if (holdUndo && message.command.kind === "undo") { holdUndo = false; heldAddresses.add(`${id}:${message.sequence}`); }
                if (holdBegin && message.command.kind === "begin") { holdBegin = false; heldAddresses.add(`${id}:${message.sequence}`); }
                if (holdEnd && message.command.kind === "end") { holdEnd = false; heldAddresses.add(`${id}:${message.sequence}`); }
                jobs.push(Promise.resolve().then(() => session.dispatch({ kind: "command",
                    address: { ...message.scope, client: id, sequence: message.sequence }, command: message.command })));
            }
        },
    }, onDefect(error) { throw error; } });
    const client = createClient(1);
    const other = createClient(2);
    const modulation = createModulationStateClient(client);
    return { client, modulation, other, session,
        holdNextEnd() { holdEnd = true; },
        holdNextBegin() { holdBegin = true; },
        holdNextUndo() { holdUndo = true; },
        releaseReplies() { for (const event of held.splice(0)) for (const receive of receivers.values()) receive(event); },
        async drain() { await Promise.all(jobs); },
        async stop() { await modulation.stop(); client.stop(); other.stop(); await session.stop(); },
    };
}
