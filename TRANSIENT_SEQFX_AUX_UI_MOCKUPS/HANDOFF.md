# SeqFX Aux Envelope — Prototype → Production Handoff

Audience: a second AI agent planning how to port the prototype's changes
back into `fx/seqfx/view/*` and, in part, `fx/seqfx/SeqFx.cmajor`.

Prototype root: `TRANSIENT_SEQFX_AUX_UI_MOCKUPS/`
Live build: `dist/index.html` (inlined JS+CSS, openable over `file://`).
Production targets:
- `ui/shared/editor-tick-slider.tsx` + `.css`
- `ui/shared/editor-tokens.ts` + `.css`
- `fx/seqfx/view/CrusherEditor.tsx` + `crusher-editor.css`
- `fx/seqfx/view/StutterEnvelopeEditor.tsx` + `stutter-envelope-editor.css`
- `fx/seqfx/view/SeqFxPatchView.tsx` (consumer; wires modulation state)
- `fx/seqfx/SeqFx.cmajor` (Slices modulation requires one DSP change)
- `fx/seqfx/view/seqfx-state.ts` + `seqfx-preset-adapter.ts` (preset schema)
- `fx/seqfx/worker/source.ts` (parameter routing)

---

## 1. Scope of the prototype

The prototype extends the existing SeqFX Crusher and Stutter editors with
a per-block aux envelope that sweeps individual parameters between a
start and end value across the duration of a SeqFX block. A shared
aux *curve* (linear, ease, exp, log, bell, hold) is selected per block
and drives all enabled per-param sweeps in lockstep.

The strategy picked is **Option 1 — Inline per-control markers** (from
the original four-option pass). Every control stays on its own row; when
modulation is enabled, the existing tick cells (or the Drive strip's
thumbs, or the Stutter gate handle) are recoloured to express the
start→end range. No new chrome or overlays were added beyond:

1. A small `M` (or `M↑`/`M↓`) badge inside each control's clickable name.
2. A shared `<AuxCurve>` component at the block scope.
3. A `GATE` toggle pill overlaid on the Stutter plot (the plot doesn't
   otherwise have a visible label for the gate param).

The user-visible interactions are:

- Click the control's name to toggle modulation on/off for that param.
  The M badge lights up yellow when active.
- Drag the cyan cell on a tick rail to set the start value, the coral
  cell to set the end value; cells between are filled yellow.
- Drag the cyan/coral thumbs on the Drive strip or the twin handles on
  the Stutter plot the same way.
- Scrub the shared aux curve's phase to sweep the block; the Crusher
  waveform preview and the Stutter envelope re-render live.

---

## 2. File inventory

```
TRANSIENT_SEQFX_AUX_UI_MOCKUPS/
├── dist/
│   └── index.html                  (self-contained build, JS+CSS inlined)
├── index.html                      (Vite entry)
├── inline-build.mjs                (post-build step — inlines assets)
├── vite.config.mjs
├── notes.md                        (design rationale + directionality table)
├── HANDOFF.md                      (this file)
└── src/
    ├── main.tsx                            (host app + demo state model)
    ├── cmps/
    │   ├── AuxCurve.tsx                    (NEW — shared block curve picker)
    │   ├── CrusherEditor.tsx               (COPIED + modulation changes)
    │   ├── EditorTickSlider.tsx            (COPIED + modulation changes)
    │   ├── StutterEnvelopeEditor.tsx       (COPIED + modulation changes)
    │   ├── crusher-preview.ts              (unchanged copy of production)
    │   ├── editor-tokens.ts                (unchanged copy of production)
    │   └── stutter-envelope.ts             (unchanged copy of production)
    └── styles/
        ├── app.css                         (prototype host chrome, ignore)
        ├── crusher-editor.css              (COPIED + additions)
        ├── editor-tick-slider.css          (COPIED + additions)
        ├── editor-tokens.css               (COPIED + one additive token)
        └── stutter-envelope-editor.css     (COPIED + additions)
```

**What's modulation-related vs incidental**

- `main.tsx` and `app.css` are demo-host only; they're not a port target
  for production. They do show the expected shape of the state model that
  `SeqFxPatchView.tsx` will need to hold.
- `crusher-preview.ts`, `stutter-envelope.ts`, `editor-tokens.ts` are
  bit-for-bit copies of production and should stay unchanged.
- `AuxCurve.tsx` is the only new component that has to exist in
  production; everything else is a diff against an existing file.

---

## 3. Shared modulation primitives

### 3.1 `ModulationDirection` type

`src/cmps/EditorTickSlider.tsx` line 5:

```ts
export type ModulationDirection = "both" | "up" | "down";
```

Constrains the relative position of the end handle to the start handle.
Needed because the Stutter capture buffer is sized at block start from
the starting slice count, so mid-block Slices can only *increase* (see
§6 for the DSP trace).

### 3.2 `EditorTickSliderModulation`

`src/cmps/EditorTickSlider.tsx` lines 7–18:

```ts
export type EditorTickSliderModulation = {
    end: number;
    onEndChange: (value: number) => void;
    phase?: number;       // 0..1 sampled aux-curve value at "now"
    direction?: ModulationDirection;
};
```

`phase` is the **curve-sampled** phase (i.e. already run through the
selected aux curve shape), not raw block position.

### 3.3 `ModBadge` component

`src/cmps/EditorTickSlider.tsx` lines 316–331:

Exported so `CrusherEditor` and `StutterEnvelopeEditor` can reuse the
exact same badge for Drive label and the Stutter Gate toggle pill.

```tsx
<ModBadge isOn={isModulated} direction={modulation?.direction} />
```

Renders a 14×12 rounded rect with dashed outline when `isOn=false`,
filled yellow (`--editor-accent-range`) with a soft glow when `isOn=true`.
Adds an up/down Unicode arrow (`↑` / `↓`) for non-`"both"` direction.

Minimum width widens to 22px when directional (`.mod-badge--directional`
at `editor-tick-slider.css` line 227).

---

## 4. EditorTickSlider changes

Production baseline: `ui/shared/editor-tick-slider.tsx`
Prototype: `src/cmps/EditorTickSlider.tsx`

### 4.1 Props added

`EditorTickSlider.tsx` lines 20–35:

```ts
export type EditorTickSliderProps = {
    // ...existing...
    modulation?: EditorTickSliderModulation | null;
    onModulationToggle?: (() => void) | null;
};
```

### 4.2 Wrapper element switched from `<label>` to `<div>`

`EditorTickSlider.tsx` line 117 (was `<label>` in production).

**Critical:** the `<label>` wrapper cannot remain in production. A
`<label>` delegates clicks on any descendant to the first labelable form
control inside it. When the label wraps a toggle `<button>` (the name
+ badge) AND a drag surface, mouseup on the drag surface synthesises a
click that the label hands off to the toggle button, disabling
modulation every drag-release. See conversation turn where the user
reported this bug; fix is to use `<div>` plus an explicit `aria-label`
on the range input when unmodulated.

### 4.3 Tick cell state machine

`EditorTickSlider.tsx` lines 146–173 (tick render).

Unmodulated (production behavior preserved):
- `is-active` for every tick at or before current value (black fill)
- `is-current` for the current tick (accent-start or accent-end)

Modulated (new):
- `is-mod-start` on the tick whose index matches the start value
- `is-mod-end` on the tick matching the end value
- `is-mod-between` on every tick strictly between low and high indices
- All other ticks keep the default gray; the "fill from zero" behavior
  is explicitly skipped

CSS rules at `editor-tick-slider.css`:
- Base tick: line 52
- Unmodulated `.is-active`: line 61
- Unmodulated `.is-current` accent-start: line 65
- Unmodulated `.is-active` accent-end: line 69
- `.is-mod-start`: line 76 → `background: var(--editor-accent-start)`
- `.is-mod-end`: line 80 → `background: var(--editor-accent-end)`
- `.is-mod-between`: line 84 → `background: var(--editor-accent-range)`

### 4.4 Clickable label + M badge

`EditorTickSlider.tsx` lines 122–143:

```tsx
<button type="button"
        className="editor-tick-slider__label editor-tick-slider__label--toggle"
        onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onModulationToggle();
        }}
        aria-pressed={isModulated}
        title={...}>
    <span>{label}</span>
    <ModBadge isOn={isModulated} direction={modulation?.direction} />
</button>
```

`stopPropagation`/`preventDefault` are belt-and-suspenders given the
outer `<div>`; leave them in because the Drive and Gate buttons also
carry them and consistency matters.

CSS for the toggle label at `editor-tick-slider.css` lines 154–183.
Hover darkens text and tints the background; focus-visible draws the
standard `--editor-accent-start` outline.

### 4.5 Layout-stability grid

`editor-tick-slider.css` line 6 (was `44px minmax(0, 1fr) 42px` in
production):

```css
grid-template-columns: 68px minmax(0, 1fr) 120px;
```

- **68 px** label column fits the label text + the `M` badge + padding,
  so toggling modulation never widens the column.
- **120 px** value column fits the widest dual-chip readout (e.g.
  `"0.50x → 2.00x"`) so toggling modulation never shrinks the rail.

Smoke-tested across off → on → off — rail width stays pixel-identical.

### 4.6 Modulated drag surface

`EditorTickSlider.tsx` lines 175–186 (usage), 218–313 (definition).

When a row is modulated the native `<input type="range">` is replaced
by a full-width `<div class="editor-tick-slider__drag-surface">` that:

1. On pointerdown, picks the nearer of `{startValue, endValue}` and
   captures it as the drag target.
2. On pointermove, updates that target with the pointer-x → value mapping.
3. On pointerup, releases capture.

Direction clamp is in `applyFromPointer`, lines 245–273. The clamp
rules:

- `direction === "up"`:
    - Dragging start above current end pushes end up to match (invariant
      `end ≥ start`).
    - Dragging end below start sticks at start.
- `direction === "down"`:
    - Dragging start below current end pushes end down to match.
    - Dragging end above start sticks at start.
- `direction === "both"` (default): no clamp.

CSS for the drag surface at `editor-tick-slider.css` line 142. Note
`z-index: 3` is required to sit above the thumbs/ticks and capture
pointer events.

### 4.7 Dual-chip readout

`EditorTickSlider.tsx` lines 199–210 (the modulated branch).

- Start chip: `background: var(--editor-accent-start)` with `color:
  var(--editor-accent-start-ink)` — CSS at line 125.
- End chip: `background: var(--editor-accent-end)` with `color:
  var(--editor-accent-end-ink)` — CSS at line 130.
- Arrow character between chips: `→` in Menlo 9px muted, line 135.

---

## 5. CrusherEditor changes

Production baseline: `fx/seqfx/view/CrusherEditor.tsx`
Prototype: `src/cmps/CrusherEditor.tsx`

### 5.1 Modulation prop shape

Lines 31–46:

```ts
type CrusherModulatedParam = {
    end: number;
    onEndChange: (value: number) => void;
    direction?: ModulationDirection;
};

export type CrusherModulation = {
    bits?: CrusherModulatedParam | null;
    holdFrames?: CrusherModulatedParam | null;
    driveDb?: CrusherModulatedParam | null;
    phase?: number;
    onToggleBits?: () => void;
    onToggleHoldFrames?: () => void;
    onToggleDriveDb?: () => void;
};
```

All direction fields default to `"both"` at usage sites. **None of the
Crusher params are directional** in the current DSP (§6).

### 5.2 Live-phase preview

Lines 148–159: `previewValues` memo computes the *live-sampled* value
for each modulated param by lerping start → end by `phase`. These
values, not the raw start values, feed `sampleCrusherPreview`. The
waveform preview at the top of the crusher panel therefore animates as
phase sweeps.

This is the single biggest conceptual change inside CrusherEditor —
production currently reads `resolved.bits`, `resolved.holdFrames`,
`resolved.driveDb` directly into `sampleCrusherPreview`. Port means
replacing those three callsites with the lerped live values when
modulation is active.

### 5.3 Pass-through wiring to EditorTickSlider (Bits, Hold)

Lines 265–293 (Bits) and lines 295–329 (Hold). Both forward `phase`
and `direction` from the incoming modulation prop into the
`EditorTickSlider.modulation` prop.

### 5.4 Drive strip — twin thumbs + yellow range fill

Element structure (lines 301–386):

- `<div class="seqfx-crusher-editor__drive">` (line 301) keeps its
  production shape; adds a `--modulated` modifier class when active.
- **Drive label becomes a `<button>`** when a toggle handler is
  supplied (lines 304–322). Same `preventDefault`/`stopPropagation`
  guard as EditorTickSlider.
- **Readout becomes a dual chip** when modulated (lines 325–339).
- **Twin thumbs:** start thumb at line 352 (cyan, canonical), end thumb
  at line 355 (`--end` modifier, coral) only when modulated.
- **Yellow range fill between thumbs** at line 346: a new span
  `<span class="seqfx-crusher-editor__drive-range">` that only exists
  when modulated.
- **Native input replaced by `<DriveModulationDragSurface>`** when
  modulated (lines 361–367); falls back to the existing hidden
  `<input type="range">` when not.

`DriveModulationDragSurface` (lines 389–478) is a structural
duplicate of the tick slider's surface, adapted for the Drive rail's
0–36 dB range. Identical direction-clamp rules in `applyFromPointer`
lines 409–433.

**Outer wrapper label switched to div:** line 294. Same `<label>` bug
as EditorTickSlider; leave as `<div>` in production too.

### 5.5 CSS additions (`crusher-editor.css`)

- `.seqfx-crusher-editor__drive--modulated`: line 168 (background tint).
- `.seqfx-crusher-editor__drive-value--modulated`: line 172 (dual-chip
  grid).
- `.seqfx-crusher-editor__drive-chip` + variants: lines 180–199.
- `.seqfx-crusher-editor__drive-arrow`: line 201.
- `.seqfx-crusher-editor__drive-range`: line 208 (the yellow fill,
  `z-index: 0` so thumbs render above it).
- `.seqfx-crusher-editor__drive-thumb--end`: line 217 (coral override).
- `.seqfx-crusher-editor__drive-input--end`: line 221 (unused now but
  kept; remove during port).
- `.seqfx-crusher-editor__drive-drag-surface`: line 232 (`z-index: 3`).
- `.seqfx-crusher-editor__drive-label--toggle`: line 243 + hover/focus
  states lines 256–268.

---

## 6. StutterEnvelopeEditor changes

Production baseline: `fx/seqfx/view/StutterEnvelopeEditor.tsx`
Prototype: `src/cmps/StutterEnvelopeEditor.tsx`

### 6.1 Modulation prop shape

Lines 45–59:

```ts
type StutterModulatedParam = {
    end: number;
    onEndChange: (value: number) => void;
    direction?: ModulationDirection;
};

export type StutterModulation = {
    gate?: StutterModulatedParam | null;
    slices?: StutterModulatedParam | null;
    speed?: StutterModulatedParam | null;
    phase?: number;
    onToggleGate?: () => void;
    onToggleSlices?: () => void;
    onToggleSpeed?: () => void;
};
```

Note: Shape intentionally omitted — it's still free-drag via the morph
track and we haven't designed aux for it yet.

### 6.2 Live effective gate

Line 222:

```ts
const effectiveGate = modulation?.gate
    ? clampStutterGate(lerp(resolved.gate, modulation.gate.end, phase))
    : resolved.gate;
```

This is threaded through the envelope path (line 226), the gate-line
x-coord (line 234), and drives the live-animated envelope shape during
phase scrub. The **user-authored start gate is never clobbered**; the
live sample is derived, same invariant as Crusher.

### 6.3 Twin-handle gate drag

`pickGateTarget`, lines 241–253: pointerdown inside the plot picks
whichever of `{gateStartX, gateEndX}` is nearer the pointer-x, and that
captures the drag.

`setGateFromClientX`, lines 255–283: applies direction clamp identically
to the tick slider's drag surface. For `direction === "up"`:

- Dragging end below start clamps at start.
- Dragging start above end pushes end up.

### 6.4 SVG overlay — twin region, lines, handles

Modulated branch at lines 418–486:

- **Bridging region** (line 418): `<rect class="seqfx-stutter-editor__gate-mod-region">` spans from `min(startX, endX)` to `max(...)`. Yellow fill, opacity 0.45 (CSS line 239).
- **Start gate line** (line 443): `--start` modifier, cyan stroke (CSS line 245).
- **End gate line** (line 450): `--end` modifier, coral stroke (CSS line 249).
- **Start handle** (line 463): `--start` modifier, cyan fill (CSS line 253).
- **End handle** (line 475): `--end` modifier, coral fill (CSS line 259).

Unmodulated branch at lines 487–511 keeps the production single-gate rendering.

### 6.5 Gate chip

Lines 535–555. Chip string:

- Unmodulated: `${percentage}%` (production)
- Modulated: `${resolved.gate.toFixed(2)} → ${end.toFixed(2)}`

Rect widens from 44→104 px when modulated (lines 541, 543). Background
flips to `--editor-surface-ink` (dark) from `--editor-accent-end`
(coral) — CSS class `--modulated` at line 272. Text color flips to
`--editor-chip-ink` (cream) — CSS at line 276.

### 6.6 `GATE` toggle pill

Lines 559–577 — an absolutely-positioned HTML button placed inside
`.seqfx-stutter-editor__viewport` at the plot's top-left corner, since
the gate param has no other visible text label.

CSS at `stutter-envelope-editor.css` lines 281–322: frosted translucent
pill with `backdrop-filter: blur(3px)`, uses the same `ModBadge` as
every other toggle. `aria-pressed="true"` darkens the label text
(line 320).

### 6.7 Pass-through wiring (Slices, Speed)

Lines 585–617 (Slices) and 623–643 (Speed): identical pattern to
CrusherEditor — pipe `phase` and `direction` into the EditorTickSlider
`modulation` prop, and `onToggleX` into `onModulationToggle`.

---

## 7. AuxCurve — new shared block-scope component

Path: `src/cmps/AuxCurve.tsx`

Lines 3: `type AuxCurveShape = "linear" | "ease" | "exp" | "log" | "bell" | "hold"`.

Lines 21–40: `sampleAuxCurve(shape, phase)` — the single source of truth
for curve evaluation. Pure function, no state. This is what
`SeqFxPatchView` should call to produce the `phase` value threaded into
each editor's `modulation` prop every block-position tick.

Lines 55–96: UI component with:
- Six labeled shape buttons (lines 66–76).
- A phase slider (lines 81–95) — useful for auditioning; in production
  this is probably not user-visible and phase comes from the playhead.
- A live curve preview SVG (lines 78–79) with an orange dot at the
  current phase.

Styling lives in `app.css` lines ~240–320 and is prototype-host-only.
In production the component should inherit from a seqfx-appropriate
style file or be stylistically merged with the existing stutter morph
track (both use the same 28 px rail + notch + thumb pattern).

---

## 8. Tokens

`src/styles/editor-tokens.css` line 44 (NEW):

```css
--editor-accent-range: #f2d16b;
--editor-accent-range-ink: #1c1c1c;
```

`#f2d16b` is the exact yellow already used by
`seqfx/view/styles.css` for `.seqfx-block[data-effect="2"]` and
`.seqfx-cell:focus-visible` — the new token is a named alias, not a new
colour.

---

## 9. Visual language summary

| Element | Off state | On state |
|---------|-----------|----------|
| M badge | dashed gray outline, faint gray M | solid yellow fill (`--editor-accent-range`) with soft glow (`0 0 8px rgba(242, 209, 107, 0.55)`) and dark M |
| M badge directional | — | adds `↑` or `↓` glyph, min-width grows from 14→22 px |
| Tick cell (start) | n/a | cyan (`--editor-accent-start`) |
| Tick cell (end) | n/a | coral (`--editor-accent-end`) |
| Tick cell (between) | n/a | yellow (`--editor-accent-range`) |
| Row background | default | `rgba(0, 180, 216, 0.06)` very subtle cyan tint |
| Value readout | single right-aligned number | `[cyan chip]  →  [coral chip]` |
| Drive thumb | single cyan filled rect (production) | cyan start + coral end + yellow range fill between |
| Stutter gate | single dark handle (production) | cyan start handle + coral end handle + yellow bridging region |
| Gate chip | coral bg, cream text, `"100%"` | dark bg, cream text, `"1.00 → 0.25"` |

Layout invariants (must hold during port):
- Tick row grid columns: `68px minmax(0, 1fr) 120px` (fits both
  unmodulated and modulated readouts).
- Drive and Gate outer wrappers are `<div>`, never `<label>` (see §4.2).

---

## 10. Directional modulation — which params, and why

Grounded in `fx/seqfx/SeqFx.cmajor`:

| Param | Direction | Reason (from DSP) |
|-------|-----------|-------------------|
| Crusher Bits | `both` | Pure quantization at line 1103, no buffer |
| Crusher Hold | `both` | 1-sample held value at line 1096–1098, no buffer |
| Crusher Drive | `both` | Linear gain at line 1084, no buffer |
| Stutter Slices | **`up`** | `stutterReadLength` pinned at `blockFrames / startSliceCount` in `startStutter` line 992; never re-read during `processStutter` |
| Stutter Speed | `both` | `phaseFrames += speed` at line 1219, wraps naturally at `readLength` |
| Stutter Shape | `both` | Envelope shaping only (line 1208) |
| Stutter Gate | `both` | Envelope shaping only (line 1208) |

**Important for the Slices port:** Slices is the **only** param that
requires a DSP-side change to become modulatable. In the current
`SeqFx.cmajor`, `stutterSliceCount[lane]` is never referenced inside
`processStutter` (lines 1184–1225). Playback wraps against
`stutterReadLength` (set once at block start, line 992).

To make Slices actually modulatable mid-block, introduce a runtime
"effective read length" used by the wrap in `readStutterCapture`
(line 1033) and the phase wrap at lines 1221–1222:

```cmajor
let effectiveReadLength = clampFloat (
    float32 (blockFrames) / float32 (currentSliceCount),
    2.0f,
    stutterReadLength[lane]    // must not exceed captured window
);
```

The upper clamp `<= stutterReadLength` encodes the `direction: "up"`
constraint at the DSP level, which matches what the prototype enforces
in the UI (`src/cmps/EditorTickSlider.tsx` lines 245–273, Stutter plot
at `StutterEnvelopeEditor.tsx` lines 261–282).

Every other modulated param is already read every frame from its
per-lane value, so those just need the worker to push time-varying
values into the same `stutter*[lane]` / `crusher*[lane]` fields (or
equivalent new endpoints) rather than snapshotting at latch.

---

## 11. State model hints for `SeqFxPatchView`

`src/main.tsx` lines 14–39 shows the prototype's state shape. Not a
literal port target (production would keep this inside the sequencer's
per-step/per-block data, not a flat `State`), but the shape of what
each block needs to carry is clear:

Per modulated parameter:
- `startValue` (already exists in production as the latched step value)
- `endValue` (NEW)
- `enabled` (NEW; boolean — equivalent to "is this param in the aux
  param list")
- `direction` (derived constant per param; see §10 — only `slices` is
  currently `"up"`)

Per block:
- `auxCurveShape: AuxCurveShape` (NEW)

Phase plumbing:
- Worker emits a per-lane block-local phase (0..1).
- `SeqFxPatchView` subscribes, samples through `sampleAuxCurve` once
  per frame, threads the result into the `phase` field of each
  editor's `modulation` prop.
- Editors use `phase` for live preview only; writes still go through
  `onStartChange` / `onEndChange`.

Toggle wiring: `onToggleBits`/etc. from `CrusherModulation` and
`StutterModulation` should:
1. Flip the `enabled` flag for that param.
2. When enabling for the first time with no meaningful end value, seed
   `end = start` (or `end = clamp(end, direction-valid-range)`). See
   `main.tsx` line 172–177 for a worked example with Slices.

---

## 12. Preset / schema touchpoints

`fx/seqfx/view/seqfx-preset-adapter.ts` and `seqfx-state.ts` will need:

1. A version bump in the preset schema.
2. Per-param optional `{ end, enabled }` plus the block-level
   `auxCurveShape`.
3. Loader treats a missing `aux` object on old presets as
   "no modulation" (no default curve, no enabled params).
4. On save, omit `aux` when no params are modulated so existing-shape
   diffs stay minimal.

No direct anchors in the prototype for this (the prototype doesn't
persist).

---

## 13. Known gaps / not yet in prototype

- **Aux phase source.** Prototype uses a manual phase scrubber; production
  needs the worker to emit phase from playhead position within each
  block. Endpoint naming is up to the port.
- **`AuxCurve` styling.** Inherits prototype host styling in `app.css`.
  In production it should share design language with the existing
  Stutter morph track (`stutter-envelope-editor.css` lines 133–234) —
  same rail + notches + thumb. Easy visual merge.
- **Presets.** Not hooked up (see §12).
- **Accessibility.** `<div>` wrappers replacing `<label>` mean the
  native range input (unmodulated path) loses its implicit label
  association. Add `aria-label={label}` on the input when porting.
- **Keyboard drag.** Production `EditorTickSlider` had no explicit
  keyboard support for the modulated drag surface; native range input
  handled it in the unmodulated path. Port should add arrow-key
  handling on the drag surface when modulated.
- **Tape Stop effect.** Not touched. Same modulation model would apply
  if/when that lane gets aux too.
- **Shape** (stutter morph track) modulation not prototyped. The morph
  track's UX would need the two-handle treatment applied to its
  existing rail, similar to Drive.

---

## 14. Suggested port order

1. Introduce `--editor-accent-range` token (`ui/shared/editor-tokens.css`) and ship it unused.
2. Port `EditorTickSlider.tsx` + `.css`: add `modulation`, `onModulationToggle`, `ModBadge`, cell states, drag surface. Swap `<label>` → `<div>`. No DSP or state hookup yet. Pass `modulation={null}` everywhere to keep behaviour unchanged.
3. Port `CrusherEditor.tsx` + `.css`: add the Drive twin-thumb + range fill, dual chip, toggle button, drag surface. Wire `modulation={null}` from `SeqFxPatchView` to keep it quiet.
4. Port `StutterEnvelopeEditor.tsx` + `.css`: twin gate handle, yellow region, gate chip widening, `GATE` toggle pill.
5. Land `AuxCurve.tsx` (no integration yet).
6. Extend `seqfx-state.ts` preset schema with aux fields (gated behind a feature flag or version bump).
7. Extend worker endpoints to publish per-lane phase.
8. Wire `SeqFxPatchView.tsx` to hold per-param modulation state, sample the shared curve, and pass real `modulation` props.
9. Add the DSP change for Slices in `SeqFx.cmajor` (§10).
10. Connect per-frame parameter values for Bits / Hold / Drive / Speed / Shape / Gate so modulation is audible (each is a 1-line change at the read site in the DSP — the plumbing is most of the work).
