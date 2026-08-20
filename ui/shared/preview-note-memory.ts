/**
 * The Auto-preview note memory (T12C): remembers the most recent completed
 * group of intentional user notes while every tracked note still contributes
 * to the group's held-note boundary.
 *
 * A group starts on the first note-on after all notes are up and commits only
 * when the held set returns to empty. Replay affordances participate in those
 * boundaries but never enter or replace the remembered group. Auto-preview
 * reads the group in ascending pitch order and uses the supplied fallback
 * until the first intentional group commits.
 */

export type PreviewNoteMemory = {
    /** Track a note-on; replay notes are held but excluded from the group. */
    noteOn(pitch: number, intentional: boolean): void;
    /** Track a note-off. Notes that are not held are ignored. */
    noteOff(pitch: number): void;
    /** Return the most recent completed group, or the initial fallback group. */
    rememberedGroup(): ReadonlyArray<number>;
};

/** Create note-group memory with a one-pitch fallback before the first commit. */
export function createPreviewNoteMemory(fallbackPitch: number): PreviewNoteMemory {
    const heldPitches = new Set<number>();
    const buildingGroup = new Set<number>();
    let rememberedGroup: ReadonlyArray<number> = [fallbackPitch];

    return {
        noteOn(pitch, intentional) {
            if (heldPitches.size === 0) {
                buildingGroup.clear();
            }

            heldPitches.add(pitch);
            if (intentional) {
                buildingGroup.add(pitch);
            }
        },

        noteOff(pitch) {
            if (!heldPitches.delete(pitch) || heldPitches.size > 0) {
                return;
            }

            if (buildingGroup.size > 0) {
                rememberedGroup = [...buildingGroup].sort((left, right) => left - right);
            }
            buildingGroup.clear();
        },

        rememberedGroup() {
            return rememberedGroup;
        },
    };
}
