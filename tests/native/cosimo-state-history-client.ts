import { createCmajorPluginStateClient } from "../../kit/ui/plugin-state-cmajor";
import { synthPluginState } from "../../ui/shared/synth-plugin-state";
import { MODULATION_STATE_KEY, createDefaultRoute } from "../../ui/shared/modulation";

// An ordinary view connection backed by the probe's real PatchView. The same
// public client as the GUI owns attachment, drafts, validation and receipts.
declare function sendNative(message: unknown): void;
let receive: ((body: unknown) => void) | undefined;
let client: ReturnType<typeof createCmajorPluginStateClient<typeof synthPluginState>>;
let serial = 0;
const outcomes = new Map<number, unknown>();
const defects: string[] = [];
const api = globalThis as unknown as Record<string, unknown>;
api.historyReceive = (body: unknown) => receive?.(body);
api.historyOpen = () => {
    client = createCmajorPluginStateClient(synthPluginState, {
        addEventListener(_type, listener) { receive = listener; },
        removeEventListener() { receive = undefined; },
        sendMessageToServer: sendNative,
    }, { onDefect: error => defects.push(String(error)) });
};
api.historyClose = () => client.stop();
api.historySnapshot = () => JSON.stringify(client.getSnapshot());
api.historyDefects = () => JSON.stringify(defects);
api.historyOutcome = (id: number) => JSON.stringify(outcomes.get(id) ?? null);
api.historyCommand = (command: Parameters<typeof client.dispatch>[0]) => {
    const id = ++serial;
    void client.dispatch(command).then(result => outcomes.set(id, result));
    return id;
};
api.historyModulationEdit = (curve: boolean) => {
    const snapshot = client.getSnapshot();
    if (snapshot.kind !== "ready") throw new Error("Client is not ready");
    const value = JSON.parse(JSON.stringify(snapshot.state.fields[MODULATION_STATE_KEY].value));
    value.routes = [createDefaultRoute({ id: "native-history-route", sourceKind: curve ? "mseg" : "velocity",
        sourceSlot: curve ? 1 : null, targetKind: "oscA.wavetablePosition", amount: 0.5 })];
    if (curve) {
        for (const key of ["shapeA", "shapeB"]) value.msegSlots[0][key].points = [
            { x: 0, y: 0.75, curvePower: 0 }, { x: 1, y: 0.75, curvePower: 0 },
        ];
    }
    return (api.historyCommand as (command: unknown) => number)({ kind: "edit", key: MODULATION_STATE_KEY, value });
};
api.historyRackEdit = () => {
    const snapshot = client.getSnapshot();
    if (snapshot.kind !== "ready") throw new Error("Client is not ready");
    const value = JSON.parse(JSON.stringify(snapshot.state.fields["lane.v1"].value));
    value.chain[0].enabled = true;
    return (api.historyCommand as (command: unknown) => number)({ kind: "edit-many", edits: [
        { key: "lane.v1", value },
        { key: "laneDistortion1OutputTrimDb", value: -6 },
    ] });
};
api.historyArticulationEdit = () => (api.historyCommand as (command: unknown) => number)({
    kind: "edit", key: "articulations.v4", value: {
        format: "cosimo.articulations", version: 4, selectedSlotId: "native-history-art", activeTriggerMode: "vel",
        slots: [{ id: "native-history-art", runtimeSlot: 7, name: "Native history", color: "red", key: 24,
            velRange: { min: 100, max: 100 }, chainRange: { min: 0, max: 0 }, overrides: {}, routeAmounts: {} }],
    },
});
