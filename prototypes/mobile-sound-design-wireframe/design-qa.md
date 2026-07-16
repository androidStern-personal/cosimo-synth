# Design QA

## Evidence

- Visual taste reference: `references/ulm-scientific-instrument.png` (directional, not cloned).
- Current implementation renders (2x): `references/implementation-current-390x844.jpg`,
  `references/implementation-current-375x667.jpg`,
  `references/implementation-source-editor-390x844.jpg`.
- Working session gallery: `/tmp/cosimo-redesign/` — default, unmapped parameter,
  two-mapping frequency, voice workspace, envelope/MSEG/macro source editors,
  expanded target with reducer, articulation override, add-source popover,
  long-press delete and Undo, live drag-to-assign, latched trigger with HUD,
  capture-created MSEG, stress fixture at both sizes.
- Canonical interaction state: Effects → Phaser → Depth selected → Macro 1
  relationship active → Pluck articulation. The rack quick control independently
  tracks the last deliberately touched parameter.

## Composition system

- One instrument surface. Four rule levels: structural ink at the five shell
  bands, hairlines inside regions, 2px or full black/white inversion for focus,
  and 3px rails reserved for source/articulation identity.
- Type is five roles only (display, navigation, label, mono value, mono micro);
  all captions uppercase; all live values tabular mono in reserved `ch` columns.
- Ink owns all structural graphics: track baselines, base fills, handles, and
  module visualizations are black on paper. Color appears only as semantic
  identity: source glyphs and slots, mapping ranges, chip rails, articulation
  marks, and the override edit layer.
- Exact vertical budgets at 390×844 (48/96/564/48/88) and 375×667
  (44/88/411/44/80); only the module graphic flexes. The relationship band is a
  permanently allocated 44+76 (40+64 compact) surface, so selecting, adding, or
  clearing mappings can never move the module or the shell.

## Region anatomy

- Header: patch identity, centered two-workspace icon carousel (framed
  neighbors, inverted current), menu.
- Rack: continuous strip of 192px tiles — identity row, quick label + reserved
  value, scrub track — with a 44px rail holding the enable cell above the
  dedicated reorder handle. Selected tile inverts; bypassed tiles mute and keep
  identical metrics. Voice modules reuse the strip without rails.
- Module editor: display-weight identity with muted context caption, framed
  live graphic with the compound Free/Sync lane reserved inside it, and one
  hairline-bounded borderless parameter matrix (2-up master, 3-up compact for
  six controls) with X/Y captions per cell.
- Relationship band: chip lane (identity, amount, vertical-scrub cue, semantic
  underline; articulation override chip when present; quiet `+` cell) above the
  fixed detail surface (source cell with rail and navigation, TO-target +
  amount + remove, polarity segmented, conditional Max/Mean reducer).
  Empty state keeps identical geometry and reads NO SOURCE.
- Source shelf: borderless legend chips — colored glyph + slot, raised
  attachment count, short color underline; orphans muted; focused chip inverts.
- Transport: labeled field row (inverted articulation select with colored
  mark, Default reset, note, trigger cell) over the quieter capture row
  (Repeat, Latch, Capture Motion, bounded mono status).

## Verification

- `npm test` — 28/28 pass (axis lock, click suppression, mapping selection,
  drag-to-assign, navigation restore, capture ownership, reducer policy).
- `npm run check:styles` — 10 CSS files pass (tokens-only values, no
  duplicates, no !important).
- `npm run build` — Vite production build passes.
- `git diff --check` — clean.
- Browser geometry audit: zero document overflow at both sizes; shell region
  heights measure exactly 48/96/564/48/88 and 44/88/411/44/80.
- Live-input verification (CDP mouse): rack scrub + focus, X/Y parameter drags
  with HUD, chip select/scrub, source lift → eligible/active drop targets →
  cancel, long-press → delete → Undo restore, latch + move + Capture creating
  a mapped MSEG with shallow return, source→target→back restoration.
- Stress fixture: maximum/signed values stay inside reserved columns, bypassed
  Delay keeps tile metrics, orphan Envelope 2 reads quiet, Pluck override shows
  articulation icon + dashed patch-base tick + override chip with reset, and
  capture status truncates inside its bounded readout.

## Known limitations

- Real DSP audio, native serialization, and physical-device haptics remain out
  of scope for this parallel prototype.
- The transport status line intentionally ellipsizes long capture descriptions
  inside its reserved column instead of reflowing the shell.
- Long-press, drag-to-assign, and reorder cannot be driven by synthetic
  `dispatchEvent` pointers (pointer-capture requires trusted input); use real
  pointer input or the unit-test harness.

final result: passed
