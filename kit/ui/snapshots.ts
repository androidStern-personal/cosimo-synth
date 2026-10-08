// Everything a state definition needs to declare snapshot slots. The hook lives in use-snapshots.ts,
// so a state.ts that spreads snapshots() keeps React out of the generated state worker.
import { storedValue, type PluginStateCodec, type PluginStateJson, type PluginStateStored } from "./plugin-state-definition";
import { frozenJson, jsonEqual, type SoundValues } from "./presets";

/** Each slot holds a captured sound or nothing. */
export type SnapshotSlots = Readonly<Record<string, { readonly values: SoundValues } | null>>;

/** The snapshot slots field, which also carries the slot names. */
export type SnapshotSlotsField = PluginStateStored<SnapshotSlots> & { readonly slots: readonly string[] };

const defaultSlots = Object.freeze(["A", "B", "C", "D", "E", "F", "G"]);

function slotsCodec(slots: readonly string[]): PluginStateCodec<SnapshotSlots> {
    return {
        // Slots a plugin update removed are dropped and new slots start empty, so older projects still load.
        parse(input) {
            if (typeof input !== "object" || input === null || Array.isArray(input)) return { kind: "error", message: "Expected snapshot slots." };
            const parsed: Record<string, { readonly values: SoundValues } | null> = {};
            for (const slot of slots) {
                const entry: unknown = Object.hasOwn(input, slot) ? Reflect.get(input, slot) : undefined;
                if (entry === undefined || entry === null) { parsed[slot] = null; continue; }
                const values = typeof entry === "object" ? frozenJson(Reflect.get(entry, "values")) : undefined;
                if (typeof values !== "object" || values === null || Array.isArray(values)) return { kind: "error", message: `Snapshot ${slot} has invalid values.` };
                parsed[slot] = Object.freeze({ values: values as SoundValues });
            }
            return { kind: "ok", value: Object.freeze(parsed) };
        },
        encode: value => value as unknown as PluginStateJson,
        equals: (left, right) => jsonEqual(left as unknown as PluginStateJson, right as unknown as PluginStateJson),
    };
}

function activeSlotCodec(slots: readonly string[]): PluginStateCodec<string | null> {
    return {
        // A slot that no longer exists is simply no longer active.
        parse: input => input === null || typeof input === "string"
            ? { kind: "ok", value: typeof input === "string" && slots.includes(input) ? input : null }
            : { kind: "error", message: "Expected a snapshot slot name or null." },
        encode: value => value,
        equals: Object.is,
    };
}

/**
 * Declare snapshot slots. Spread the result into `definePluginState`: it adds `snapshotSlots`,
 * the captured sounds, and `activeSnapshot`, the selected slot. Both are saved with the project.
 */
export function snapshots(options: { readonly slots?: readonly string[] } = {}) {
    const slots = Object.freeze([...(options.slots ?? defaultSlots)]);
    if (slots.length === 0 || slots.some(slot => typeof slot !== "string" || slot.length === 0) || new Set(slots).size !== slots.length)
        throw new Error("Snapshot slots must be distinct, non-empty names.");
    const empty = Object.fromEntries(slots.map(slot => [slot, null]));
    return {
        snapshotSlots: Object.freeze({ ...storedValue({ codec: slotsCodec(slots), initial: empty, history: false, preset: false }), slots }),
        activeSnapshot: storedValue<string | null>({ codec: activeSlotCodec(slots), initial: null, preset: false }),
    };
}
