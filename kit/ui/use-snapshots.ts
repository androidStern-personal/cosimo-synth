import type { PluginStateFields, PluginStateStored } from "./plugin-state-definition";
import { usePluginState } from "./plugin-state-react";
import { editOutcome, soundChanges, type PresetActionResult, type SoundValues } from "./presets";
import type { SnapshotSlots, SnapshotSlotsField } from "./snapshots";
import { useActionError, useCurrentSound, type SoundLibraryStatus } from "./use-presets";

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
