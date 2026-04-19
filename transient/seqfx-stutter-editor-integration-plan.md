# SeqFX Stutter Editor Integration Plan

## Goal

Replace the generic SeqFX stutter number inputs with the interactive editor from
`transient/seqfx-stutter-editor-interactive.html`, preserving the mockup's visual
structure and interaction model while wiring it to real SeqFX state and DSP.

The shipped UI must stay faithful to the mockup. Do not throw out the graph,
corner pills, gate chip, morph rail, or repeat strip and rebuild a different
control surface. Adapt the typography to match the existing SeqFX/plugin font
stack.

## What Stays From The Prototype

- One large single-cut envelope graph.
- Coral gate handle and pinned gate chip.
- Slices and Speed corner controls.
- Shape morph rail with labels: Gate, Eased, Triangle, Bell, Ramp down, Ramp up.
- Small repeat strip under the graph.
- Existing dark SeqFX inspector framing.
- Existing block mix row behavior.
- Pointer-drag interaction for Gate and Shape.
- Shape label clicks that snap to shape stops.
- Keyboard support for the morph rail.

## What Changes From The Prototype

- Remove the demo shell, instructions, live-state side panel, edge-case notes,
  and footer.
- Increase repeat-strip tick thickness/height so slice count is easier to read.
- Convert prototype JS into a controlled React component.
- Scope CSS under SeqFX class names.
- Fix the prototype morph-label bug by using the real shape stop count.
- Wire all edits through the existing SeqFX bridge/state update path.
- Use the SeqFX font stack, not the prototype page font.

## Parameter Model

Stutter params:

- `0`: Slices, integer `2..32`.
- `1`: Speed, float `0.5..2.0`.
- `2`: Shape, float `0..1`.
- `3`: Gate, float `0..1`.

Defaults:

- Slices: `8`
- Speed: `1.00`
- Shape: `0.55`
- Gate: `0.68`

No backward-compatibility migration is required.

## DSP Model

For active stutter playback:

1. Capture the first slice as the current DSP already does.
2. Compute `phase = stutterPhaseFrames / stutterReadLength`.
3. If `phase >= gate`, envelope amplitude is `0`.
4. Otherwise evaluate the morphed envelope shape using `u = phase / gate`.
5. Multiply the stutter sample by the envelope before wet/dry stutter mix.

Use cheap envelope approximations in DSP. The UI graph and DSP should use the
same model closely enough that visual changes match audible behavior.

## Implementation Steps

1. Add a pure stutter-envelope helper for constants, clamping, labels, and graph
   sampling.
2. Extend SeqFX state defaults, param limits, normalization, and upload behavior
   for stutter Shape and Gate.
3. Add DSP stutter envelope params and envelope evaluation.
4. Extract a controlled React `StutterEnvelopeEditor` component from the mockup.
5. Replace the generic stutter inspector branch with the new editor.
6. Add focused tests before implementation for each layer.
7. Run focused tests, Cmajor/audio probes, browser interaction tests, and a
   SeqFX build.

## Acceptance Criteria

- Selecting a stutter block shows the new stutter editor, not generic number
  inputs.
- The editor visually matches `seqfx-stutter-editor-interactive.html` in
  structure: graph, gate handle/chip, corner controls, morph rail, repeat strip,
  and mix row.
- The repeat strip remains present and its ticks are visibly thicker than the
  prototype.
- Slices +/- updates stutter param `0`, clamps to `2..32`, and updates the repeat
  strip and `xN` badge.
- Speed +/- updates stutter param `1`, clamps to `0.5..2.0`, and displays two
  decimals.
- Dragging/tapping the graph updates Gate param `3` and clamps the chip inside
  the plot.
- Dragging the morph rail updates Shape param `2`.
- Clicking each morph label snaps Shape to the corresponding stop.
- Keyboard left/right/home/end on the morph rail changes Shape predictably.
- Shape and Gate are continuous float params; Shape is not rounded.
- Block-level stutter editor changes apply to the whole selected block. If a
  selected group of blocks is active, changes apply to every selected block.
- DSP output changes audibly when Gate or Shape changes.
- Gate `0` silences the wet stutter repeat; Gate `1` allows the full cut.
- Tests cover envelope math, state normalization, UI interaction, block-wide
  writes, and Cmajor/audio behavior.
- SeqFX builds after implementation.
