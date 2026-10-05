import { storedValue, type PluginStateCodec, type PluginStateFields, type PluginStateJson, type PluginStateStored } from "./plugin-state-definition";
import { usePluginState } from "./plugin-state-react";
import {
    editOutcome, frozenJson, jsonEqual, soundChanges, useActionError, useCurrentSound,
    type PresetActionResult, type SoundLibraryStatus, type SoundValues,
} from "./presets";

/** Each slot holds a captured sound or nothing. */
export type SnapshotSlots = Readonly<Record<string, { readonly values: SoundValues } | null>>;

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

/** Everything `SnapshotBar` shows and does, available to custom snapshot interfaces. */
export interface Snapshots {
    readonly status: SoundLibraryStatus;
    readonly error: string | null;
    readonly slots: readonly { readonly id: string; readonly filled: boolean }[];
    readonly active: string | null;
    /**
     * Switch to a slot as one Undo entry. The slot being left first keeps the current sound,
     * so tweaks made while it was selected are not lost. An empty slot captures the current sound.
     */
    select(slot: string): Promise<PresetActionResult>;
    /** Empty a slot; clearing the selected slot also deselects it. Not an Undo entry. */
    clear(slot: string): Promise<PresetActionResult>;
}

type SnapshotSlotsField = PluginStateStored<SnapshotSlots> & { readonly slots: readonly string[] };

function isSnapshotSlotsField(field: unknown): field is SnapshotSlotsField {
    return typeof field === "object" && field !== null && Reflect.get(field, "kind") === "stored" && Array.isArray(Reflect.get(field, "slots"));
}

/** Snapshots for a definition that spreads `snapshots()`. */
export function useSnapshots(definition: PluginStateFields): Snapshots {
    const slotsField = definition.snapshotSlots, activeField = definition.activeSnapshot;
    if (!isSnapshotSlotsField(slotsField) || activeField?.kind !== "stored")
        throw new Error("useSnapshots needs snapshots in the plugin state. Spread snapshots() into definePluginState.");
    const editor = usePluginState(definition);
    const slotsControl = usePluginState(slotsField);
    // SAFETY: activeSnapshot is the field snapshots() declares with this value type.
    const activeControl = usePluginState(activeField as PluginStateStored<string | null>);
    const sound = useCurrentSound(definition);
    const { error, settle } = useActionError();

    const stored = "value" in slotsControl.state ? slotsControl.state.value : null;
    const active = "value" in activeControl.state ? activeControl.state.value : null;
    const ready = sound.status === "ready" && stored !== null && "value" in activeControl.state;
    const status: SoundLibraryStatus = ready ? "ready"
        : sound.status === "unavailable" || slotsControl.state.status === "invalid" || slotsControl.state.status === "unavailable"
            || activeControl.state.status === "invalid" || activeControl.state.status === "unavailable" ? "unavailable" : "loading";
    const unavailableReason = status === "unavailable" ? slotsControl.error?.message ?? activeControl.error?.message ?? "Snapshots are unavailable." : null;
    const act = async (slot: string, action: (slots: SnapshotSlots, saved: SoundValues) => Promise<PresetActionResult> | PresetActionResult) => {
        if (!ready || !stored || sound.status !== "ready") return settle({ kind: "failed", message: unavailableReason ?? "The plugin is still loading. Try again in a moment." });
        if (!slotsField.slots.includes(slot)) return settle({ kind: "failed", message: `There is no snapshot slot "${slot}".` });
        return settle(await action(stored, sound.saved));
    };

    return {
        status, error: error ?? unavailableReason,
        slots: slotsField.slots.map(id => ({ id, filled: Boolean(stored?.[id]) })),
        active,
        select: slot => act(slot, (slots, saved) => {
            if (slot === active) return { kind: "done" };
            const next = { ...slots };
            if (active !== null) next[active] = { values: saved };
            const target = slots[slot];
            if (!target) next[slot] = { values: saved };
            // snapshotSlots never records history, so this one edit's Undo entry
            // restores only the sound and the selected slot.
            return editor.edit({ ...(target ? soundChanges(definition, target.values) : {}), snapshotSlots: next, activeSnapshot: slot },
                { recall: true }).then(editOutcome);
        }),
        clear: slot => act(slot, slots => editor.edit({ snapshotSlots: { ...slots, [slot]: null }, ...(slot === active ? { activeSnapshot: null } : {}) },
            { history: false }).then(editOutcome)),
    };
}
