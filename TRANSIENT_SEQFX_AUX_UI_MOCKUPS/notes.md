# SeqFX Aux Envelope — Option 1 interactive prototype

Real `CrusherEditor` and `StutterEnvelopeEditor` components, copied out of
`fx/seqfx/view/` and extended with a `modulation` prop that adds per-param
start/end markers to the existing EditorTickSlider rows and the Drive strip,
plus twin gate handles on the Stutter plot.

## Open it

Just open `dist/index.html` directly — the JS and CSS are inlined so it works
over `file://`:

```
open /Users/winterfell/src/cosimo-synth/TRANSIENT_SEQFX_AUX_UI_MOCKUPS/dist/index.html
```

## Rebuild after editing

```
npx vite build --config TRANSIENT_SEQFX_AUX_UI_MOCKUPS/vite.config.mjs \
  && node TRANSIENT_SEQFX_AUX_UI_MOCKUPS/inline-build.mjs
```

## Dev server with hot reload

```
npx vite --config TRANSIENT_SEQFX_AUX_UI_MOCKUPS/vite.config.mjs
```

Then open `http://127.0.0.1:5180/`.

## What you can play with

- Check/uncheck **Modulation Enables** on the left to toggle each param's
  modulation on and off.
- Drag any **cyan diamond** on a tick rail to set the start value; drag the
  **coral diamond** to set the end value. Whichever marker is closer to the
  pointer captures the drag.
- On the Drive strip, the square thumbs are the drag targets (cyan = start,
  coral = end).
- On the Stutter plot, both gate handles live at the bottom edge; nearer
  one wins the drag.
- Scrub the **Phase** slider in the Aux Curve panel to sweep the block. The
  live sampled value is shown as a small black tick on each rail, as a small
  mark on the Drive strip, and drives the Crusher waveform preview and the
  Stutter envelope fill in real time.
- Switch **Aux Curve** shape (Lin / Ease / Exp / Log / Bell / Hold) and
  watch the shape of the sweep change.
- The three **Block Scenarios** buttons preload states:
    - *Brief example* — the exact values from the task brief.
    - *Heavy sweep* — every param modulated with wide ranges.
    - *No mod* — everything un-modulated.

## Files worth reading

- `src/cmps/EditorTickSlider.tsx` — a copy of
  `ui/shared/editor-tick-slider.tsx`, plus a `modulation` prop and a
  `ModulatedDragSurface` that routes pointer events to the nearer handle.
- `src/cmps/CrusherEditor.tsx` — copy of `fx/seqfx/view/CrusherEditor.tsx`,
  extended with a `modulation` prop (bits / holdFrames / driveDb), a live
  preview that lerps the three params by `phase`, twin thumbs on the Drive
  strip, and a `DriveModulationDragSurface`.
- `src/cmps/StutterEnvelopeEditor.tsx` — copy of the Stutter editor with a
  twin gate handle, a bridging dashed region between them, and a dark
  "start → end" chip when the gate is modulated.
- `src/cmps/AuxCurve.tsx` — the shared block-level curve picker + phase
  scrubber (new; styled to match the existing Stutter morph track).
- `src/main.tsx` — the harness: state for all params + modulation flags +
  curve shape + phase, wired into both editors.
- `src/styles/*.css` — copies of the production CSS with an appended
  modulation section at the bottom of each file.

## Implementation notes / cautions this prototype surfaces

- **Quantized params sweep fine** but snap visibly. Bits and Hold are
  `Math.round`-ed through `clampCrusher*`; dragging either handle moves in
  one-tick increments and the wet-preview waveform quantizes to the
  integer level as you scrub the phase. Looks intentional, not buggy.
- **The stored `start` value is the user's authored number, never the
  live-sampled one**, so toggling modulation off instantly returns the
  control to its start value. That matters for preset round-tripping.
- **Both gate handles share the same hit-target geometry** (halo + handle
  at plot-bottom); the Stutter editor now picks the nearer one on
  pointerdown instead of always routing to the start gate.
- **Each EditorTickSlider row knows if it's modulated** and widens its
  right-hand column from 42 px to 108 px to fit the `start → end` chip
  pair. Unmodulated rows are byte-identical to production.
- **Phase is one number per block**, fed to every modulated param at once.
  That's consistent with the "one shared aux curve per block" semantics
  from the brief — no per-param curves.
- The Drive strip's start thumb keeps its canonical filled-cyan look.
  The end thumb reuses the same `.seqfx-crusher-editor__drive-thumb` class
  with a single-property color override, so visual weight matches.
