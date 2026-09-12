# Enhance That state and history

`state.ts` declares the eight automatable sound controls. `view/source.ts`
uses the public Builder Kit state hooks and `createStatefulPatchView`; the
existing graph, readouts and analyzer remain the presentation. The plugin
configuration's `stateSource` generates its persistent state worker.

The Undo and Redo buttons follow shared latest-first history across those
controls. A drag of one scalar is one entry. A graph drag that changes
frequency, amount and Q currently creates one entry per changed scalar;
it is not a compound gesture that a single Undo restores in full. Closing
and reopening the GUI retains the owner's current state and history.

The preset and A–G snapshot controllers retain their existing host write
path. Recalls do not create shared Undo entries. Existing user-edit history
remains available after those authoritative external writes, so Undo may
restore a recorded user baseline rather than the complete sound from before
the recall. Preset and snapshot Undo integration is not supplied by this view.

The silent browser preview exercises the real session and client against
page-local storage. It has no audio engine or DAW; its state resets on page
reload. A passing preview is separate from a native or audio qualification.
