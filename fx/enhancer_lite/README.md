# Enhance That state and history

`state.ts` declares the eight automatable sound controls, presets and A–G
snapshots. `view/source.ts` uses the public Builder Kit state hooks and
`createStatefulPatchView`; its header holds the kit's `PresetBar`,
`SnapshotBar` and Undo/Redo, and the existing graph, readouts and analyzer
remain the presentation. The plugin configuration's `stateSource` generates
its persistent state worker. The factory presets live in
`view/factory-presets.ts`, keyed by the state field names.

The Undo and Redo buttons follow shared latest-first history across those
controls. A drag of one scalar is one entry. A graph drag that changes
frequency, amount and Q currently creates one entry per changed scalar;
it is not a compound gesture that a single Undo restores in full. Closing
and reopening the GUI retains the owner's current state and history.

Recalling a preset, reverting to it, or selecting a snapshot is one Undo
entry that restores the whole sound and the active preset or slot. Saving,
renaming or deleting presets and clearing slots are not undoable.

The silent browser preview exercises the real session and client against
page-local storage. It has no audio engine or DAW; its state resets on page
reload. A passing preview is separate from a native or audio qualification.
