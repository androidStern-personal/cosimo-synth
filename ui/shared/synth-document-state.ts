import type { PluginStateCodec } from "../../kit/index";
import { deserializeLaneStateV2, serializeLaneStateV2, type LaneStateV2 } from "./lane-state-v2";
import { parseArticulationsV4, serializeArticulationsV4, type ArticulationsState } from "./articulation-image";

function freezeDocument(value: unknown): void {
    if (value === null || typeof value !== "object") return;
    for (const child of Object.values(value)) freezeDocument(child);
    Object.freeze(value);
}

export const rackStateCodec: PluginStateCodec<LaneStateV2> = {
    parse(input) {
        const value = deserializeLaneStateV2(input);
        if (!value) return { kind: "error", message: "Invalid rack document." };
        freezeDocument(value);
        return { kind: "ok", value };
    },
    encode: serializeLaneStateV2,
    equals: (a, b) => serializeLaneStateV2(a) === serializeLaneStateV2(b),
};

// An accepted document is frozen, so its saved text is computed once however often it is
// compared. The articulation bank can be megabytes, and every state update compares it.
const articulationText = new WeakMap<ArticulationsState, string>();
export function savedArticulationText(value: ArticulationsState): string {
    if (!Object.isFrozen(value)) return JSON.stringify(serializeArticulationsV4(value));
    let text = articulationText.get(value);
    if (text === undefined) articulationText.set(value, text = JSON.stringify(serializeArticulationsV4(value)));
    return text;
}

/** Validate the saved schema independently; the paired modulation projection
 * validates route references against its current bank before engine delivery. */
export const articulationStateCodec: PluginStateCodec<ArticulationsState> = {
    parse(input) {
        let raw = input;
        if (typeof raw === "string") {
            try { raw = JSON.parse(raw); }
            catch { return { kind: "error", message: "Invalid articulation JSON." }; }
        }
        const routeIds = new Set<string>();
        if (raw !== null && typeof raw === "object" && Array.isArray(Reflect.get(raw, "slots"))) {
            for (const slot of Reflect.get(raw, "slots")) {
                if (slot === null || typeof slot !== "object") continue;
                const amounts = Reflect.get(slot, "routeAmounts");
                if (amounts !== null && typeof amounts === "object")
                    for (const id of Object.keys(amounts)) routeIds.add(id);
            }
        }
        const parsed = parseArticulationsV4(raw, routeIds);
        if (parsed._tag === "err") return { kind: "error", message: parsed.error.message };
        freezeDocument(parsed.value);
        return { kind: "ok", value: parsed.value };
    },
    encode: savedArticulationText,
    equals: (a, b) => a === b || savedArticulationText(a) === savedArticulationText(b),
};
