import type { PluginStateCodec } from "../../kit/ui/plugin-state-definition";
import { parseModulationState, serializeModulationState, type ModulationState } from "./modulation";

// The strict parser builds fresh JSON records. Freeze that owned tree so callers
// cannot mutate either the current value or a value retained by shared history.
function freezeDocument(value: unknown): void {
    if (value === null || typeof value !== "object") return;
    for (const child of Object.values(value)) freezeDocument(child);
    Object.freeze(value);
}

/** The existing v6 document at the shared state owner's codec seam. */
export const modulationStateCodec: PluginStateCodec<ModulationState> = {
    parse(input) {
        const parsed = parseModulationState(input);
        if (parsed._tag === "err") return { kind: "error", message: parsed.error.message };
        freezeDocument(parsed.value);
        return { kind: "ok", value: parsed.value };
    },
    encode: serializeModulationState,
    equals: (left, right) => serializeModulationState(left) === serializeModulationState(right),
};
