# Enhance That

Enhance That is the Builder Kit's worked example: a one-band harmonic enhancer
with a draggable response graph, live input and output spectra, presets,
A–G snapshots and shared Undo. Every sound value it shows, saves and undoes
goes through the kit's plugin state (`usePluginState`). The one direct host
write is the analyzer's on/off switch.

## Files

| File | What it is |
|---|---|
| `state.ts` | The eight automatable sound controls, presets and snapshots. The plugin configuration's `stateSource` names it, and `npm run fx:build` generates the state worker from it. |
| `view/factory-presets.ts` | The factory sounds, keyed by the state field names. |
| `view/source.tsx` | The editor: the header with the kit's `PresetBar`, `SnapshotBar` and Undo/Redo, the readouts and the switches, wrapped in `createStatefulPatchView`. It also exports `browserPreviewParameters` for the silent browser preview. |
| `view/sound.ts` | `useSound()`: one `usePluginState` control per sound field, and the sound once every value has arrived. |
| `view/response-graph.tsx` | The response graph and the analyzer overlay. |
| `view/readout.tsx` | A value you can drag, step with the arrow keys or type exactly. |
| `view/quantities.ts` | Frequency, amount and Q: ranges, display text, drag and keyboard laws, and exact entry. The readouts and the graph share them. |
| `view/spectrum.ts` | The graph's geometry, the response curves and the analyzer smoothing. |
| `view/enhance-that.css` | The look: black surface, cyan and lime neon, SF Mono. |

## Editing

- Drag the graph's handle or curve to move frequency (horizontally) and amount
  (vertically); hold Shift to drag Q instead. The whole drag is one gesture: it
  opens with `beginGesture(["frequency", "amount", "q"])` on the state editor,
  the host sees one automation touch per parameter, and one Undo restores all
  three.
- Drag a readout along its arrow, step it with the arrow keys, or press Enter or
  double-click it to type a value such as `2.5k`, `6 dB` or `0.7`. A typed value
  is one Undo entry; Escape cancels.
- With the graph handle focused, Left and Right step frequency, Up and Down step
  amount, and Shift with any arrow steps Q. Arrow keys pressed during a drag
  join the drag's gesture.
- The Shape, Route, Character and Intensity switches set their parameter through
  its state control; each change is one Undo entry.

In Mid/Side the graph shows a second, magenta Side band, and a Side readout
appears. Mid and Side share frequency and Q.

The analyzer runs only while the editor is open: the graph switches the hidden
`analyzerEnabledIn` endpoint on when it mounts and off when it closes, and it
only listens to the `inputSpectrum` and `outputSpectrum` endpoints.

## Presets, snapshots and Undo

Recalling a preset, reverting to it, or selecting a snapshot is one Undo entry
that restores the whole sound and the active preset or slot. Saving, renaming
or deleting presets and clearing slots are not undoable. Closing and reopening
the editor keeps the current state and history.

## Preview

`npm run fx:dev` serves the editor at
`http://127.0.0.1:5175/fx/enhancer_lite/view/harness.html`. The preview runs the
real state session against page-local storage. It has no audio engine or DAW;
its state resets on page reload. A passing preview is separate from a native or
audio qualification.
