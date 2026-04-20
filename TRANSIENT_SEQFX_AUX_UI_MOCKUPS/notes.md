# SeqFX Aux Envelope — Option 1 interactive prototype

Real `CrusherEditor` and `StutterEnvelopeEditor` components, copied out of
`fx/seqfx/view/` and extended with a `modulation` prop. When a parameter is
modulated:

- The **tick slider** stops drawing "fill from zero" and instead recolors
  three existing tick cells: one **cyan** (start), one **coral** (end), and
  the cells between them **yellow**. Those colored cells are the drag
  handles — there are no extra markers or overlays.
- The **Drive strip** keeps its cyan start thumb and adds a coral end thumb,
  with a solid yellow fill between them.
- The **Stutter plot** grows a twin coral gate handle and the bridging
  region fills yellow.

Every slider row reserves 120 px for the value readout whether modulation is
on or off, so toggling modulation never shifts the rail width.

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

- **Click any control's name** — Bits, Hold, Drive, Gate, Slices, Speed —
  to toggle modulation on or off. A small `M` badge next to the label
  lights up yellow with a soft glow when modulation is active and fades to
  a dashed outline when it's off. No separate checkbox panel; the label
  itself is the toggle.
- On the Stutter plot, the Gate toggle lives as a small frosted pill in
  the top-left corner that shows `GATE [M]`.
- When modulation is on, drag the **cyan cell** on any tick rail to move
  the start value and the **coral cell** to move the end value; cells
  between them are filled yellow. Whichever cell is closer to the pointer
  captures the drag.
- On the Drive strip, the square cyan/coral thumbs are the drag targets
  and the rail between them is filled yellow.
- On the Stutter plot, both gate handles live at the bottom edge; nearer
  one wins the drag.
- Scrub the **Phase** slider in the Aux Curve panel to sweep the block —
  the Crusher waveform preview and the Stutter envelope animate through
  the swept range in real time.
- Switch **Aux Curve** shape (Lin / Ease / Exp / Log / Bell / Hold) and
  watch the shape of the sweep change.
- The three **Block Scenarios** buttons preload states:
    - *Brief example* — the exact values from the task brief.
    - *Heavy sweep* — every param modulated with wide ranges.
    - *No mod* — everything un-modulated.

### Directional modulation (one-way params)

Some parameters are physically one-way — Slices is the only example in
the current SeqFX DSP.

The data model encodes this as a `direction: "both" | "up" | "down"` field
on the per-param modulation record.

UI consequences when direction is not `"both"`:

- The M badge renders as `M↑` (for `"up"`) or `M↓` (for `"down"`).
- Dragging the end cell is clamped on the forbidden side — you can't push
  it past the start the wrong way; it just sticks at the start.
- Dragging the start cell past the end also drags the end along, so the
  invariant (`end ≥ start` for up, `end ≤ start` for down) is preserved
  without making the user chase handles.
- Hover tooltip on the name reads e.g. `"Slices: click to disable aux
  modulation (up-only)"` so the constraint is discoverable.

### Directions grounded in `SeqFx.cmajor`

Verified against the production DSP at `fx/seqfx/SeqFx.cmajor`:

| Param | Direction | Reason |
|-------|-----------|--------|
| Crusher Bits | `both` | Pure playback-time quantization (`levels = (1 << (bits - 1)) - 1`, line 1103). No buffer. |
| Crusher Hold | `both` | 1-sample hold counter (`crusherHeld` is `float32<2>`, line 329). No buffer; any value works at any time. |
| Crusher Drive | `both` | Linear gain (`driveGain = dbToGain(driveDb)`, line 1084). No constraint. |
| Stutter Slices | **`up`** | `stutterReadLength` is pinned at `blockFrames / startSliceCount` in `startStutter` (line 992). The DSP wraps at `readLength`, which is the *captured* window. To modulate mid-block, the worker would have to introduce an effective read length of `blockFrames / currentSliceCount`, which must be ≤ `readLength` (captured amount). That means current count ≥ start count → more/shorter slices only. |
| Stutter Speed | `both` | `stutterPhaseFrames += stutterPlaybackSpeed` (line 1219) with natural wrap at `stutterReadLength`. No buffer concern — you can speed up or slow down freely; the wrap just happens more or less often. |
| Stutter Shape | `both` | Pure envelope shaping in `stutterEnvelopeAt` (line 1208). No buffer. |
| Stutter Gate | `both` | Pure envelope shaping. No buffer. |

Caveat worth flagging: **in the current DSP, Slices is never read during
`processStutter`** — `stutterSliceCount` is only consumed at block start
by `latchStutterStep` to size the capture. So making Slices actually
modulatable requires a DSP-side change: introduce a runtime "effective
read length" used by `readStutterCapture` wrap and the `phaseFrames`
wrap (currently both use `stutterReadLength[lane]`), and enforce
`effectiveReadLength ≤ stutterReadLength`. Every other param in the
table above is already read every frame, so wiring them up just needs
the worker to push time-varying values through endpoints rather than
snapshotting at latch.

### Layout stability

Every tick-slider row reserves 68 px for the label-with-badge column and
120 px for the value-readout column whether modulation is on or off, so
toggling any M badge never shrinks or shifts the slider rail. The smoke
test verifies rail width is pixel-identical across the off → on → off
transition.

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
