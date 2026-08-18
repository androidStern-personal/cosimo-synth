# ADR-024: Mobile Voice uses a focused oscillator editor

Status: accepted — 2026-08-18; wavetable graph X binding provisional — 2026-08-18; amended after the final visual prototype — 2026-08-18 (see the amendment at the end)

## Context

The current compact Voice surface gives a large amount of vertical space to one
wavetable graphic, then places important oscillator controls below the initial phone
viewport. A first exploration tried three simultaneous oscillator cards. That improved
comparison, but each card spent too much width and height on identity rails, borders,
gradients, duplicate power affordances, and secondary controls.

Variant D of the throwaway mobile Voice prototype instead gives one oscillator the full
editing width behind A/B/C tabs. It was iterated against the real 22-parameter
oscillator contract and the existing mobile modulation model. The exploration also
established a compact numeric-readout interaction that preserves base and modulation
context without leaving full-sized knobs permanently on screen.

The interaction must remain truthful to Cosimo's existing route semantics. Selecting a
source and target is not route creation, a readout may edit only the selected real
route, and route amounts must come from the canonical fine-grained binding rather than
the deferred broad modulation document.

## Decision

### Surface composition

- Compact Voice uses one edge-to-edge focused oscillator editor behind three equal,
  letter-only A/B/C tabs. It does not render three oscillator cards at once.
- Tapping an inactive tab selects that oscillator. Tapping the already-active tab
  toggles the oscillator's existing Mute parameter. A muted oscillator is visibly
  greyed but remains editable. There is no duplicate Mute button or second A/B/C power
  label. Solo remains a dedicated action at the upper right of the focused editor.
- Semitone and Unison Voices remain direct controls above the wavetable because they
  are high-frequency sound-design moves. The Semitone shortcut and the Tune-page
  Semitone readout are two views of one endpoint, never duplicated state.
- The selected oscillator's wavetable graph owns the full available content rectangle.
  Its real drawing continues behind two small corner controls; the controls do not
  reserve a blank band or inset the renderer.
- Wavetable selection overlays the graph at top left. Tapping it opens the real
  wavetable picker. Warp Mode overlays the graph at top right. Tapping it cycles the
  real Warp Mode choices. There is no permanently visible Frame or Index control.
- The parameter toolbar is flush with the graph and reads as its bottom instrument
  strip. It has no surrounding card, large radius, gradient, or exterior phone-content
  padding. Thin separators and state color provide structure.
- The toolbar has five cyclic pages: Shape, Tune, Unison, Phase, and Modes. Previous and
  next paddles share the parameter row; there is no separate pager row and no horizontal
  page-swipe gesture competing with parameter scrubbing.
- Page choice is remembered separately for A, B, and C for the current UI session. It
  is presentation state, not patch or preset state.

### Wavetable graph axes (provisional)

- The drawable wavetable graph uses the numeric readout cells' rolling dominant-axis
  behavior. It begins pending, classifies horizontal movement as Warp Amount or vertical
  movement as Index / Frame Position, and changes only the active value. It may switch
  axes during the same drag when the other direction clearly dominates; release is not
  required. The switching sample is consumed, direction history is cleared, and
  orthogonal motion is discarded so no diagonal debt or value jump is possible.
- The Shape-page Index and Warp readouts remain aliases of those same two endpoints for
  precise and accessible editing. The graph does not create duplicate state.
- Wavetable selection remains the explicit top-left picker for this cutover. Horizontal
  graph movement must not switch tables at the same time as it edits Warp Amount.
- The horizontal binding is provisional. A later physical-use review may replace
  horizontal Warp editing with discrete wavetable switching if that proves more useful.
  The graph-axis projection must therefore isolate the X binding from the Y/Index
  binding; this is an implementation seam, not a shipped user preference or dual mode.
- Axis direction, sensitivity, and pickup are device-calibration details. They may be
  tuned without changing which parameter each axis owns.
- Once an axis is classified, the top-left Wavetable selector smoothly gives way to a
  live readout for the active graph value: Warp percentage while horizontal is active,
  or Index while vertical is active. An in-gesture axis switch updates that readout with
  the same restrained transition. Release or cancellation returns it to the Wavetable
  selector. Warp Mode remains at top right throughout, and none of these transitions
  change graph geometry.

### Dense readouts and rails

- A continuous parameter is rendered as one compact inline label/value pair. Label and
  value stay on the same row; approved abbreviations may be used when the full label
  cannot fit. The whole cell is the hit target.
- The bottom rail never fills from an origin to represent the base. The base value is
  one neutral tick. The selected route's projected low-to-high travel is a
  source-colored band around that tick, clipped to the legal parameter range.
- The rail depicts the selected source/target route only, not the sum of all routes.
  No source, unmapped, mapped-at-zero, mapped, and bypassed are visually distinct.
  Non-modulatable parameters do not show a false modulation band.
- Discrete parameters use compact choice cells in the same toolbar row. They cycle or
  open their choices on tap and do not pretend to have a continuous modulation rail.

### Readout-cell two-axis editing

- Horizontal movement edits the base value: right increases and left decreases.
- Vertical movement edits the selected route amount: up increases and down decreases.
- Direction is not locked until release. A rolling dominant-axis classifier assigns
  each movement segment to exactly one axis and may switch axes during the same touch.
  Orthogonal movement is ignored rather than accumulated, so switching cannot cause a
  delayed jump and one event never changes both values.
- Base edits use the parameter's real range, step, detents, and host binding. Octave and
  Semitone remain integer-detented with best-effort haptics; Fine and Level remain
  continuous.
- Modulation edits use only an existing selected route. They never create a mapping,
  retain a draft amount, enable a bypassed route, or imply that an unmapped pair is
  mapped. Octave, Semitone, and Fine all edit the existing aggregate Tune route and must
  identify it as Tune rather than falsely claiming three independent modulation
  targets.
- An active readout gesture owns touch scrolling. Pointer capture is primary, with a
  window-level fallback. Safari touch movement does not depend on `buttons`.
  Pointer/touch release, cancellation, window blur, document hiding, orientation loss,
  and unmount clean up exactly once. Losing pointer capture alone is not terminal.
  Scrolling outside an active readout remains normal.

### Heads-up display

- After the gesture has resolved to an axis, a transient HUD appears at the fixed top
  center of the instrument viewport, inside the safe area. It does not follow the
  finger, return to the control, or run adaptive above/below/left/right placement.
- The HUD is noninteractive and cannot take the pointer. It remains in the same place
  while the active axis changes.
- The HUD reuses the established FX dual-ring knob artwork and source-color grammar,
  but not the FX knob's gesture mapping. It names `BASE ↔` or `MOD ↕`, uses the
  correct parameter/target label, shows the armed source and real route amount, places
  the base value in the knob center, and labels the projected Low and High values.
- Normal release may leave the HUD visible briefly; cancellation and loss of app
  context hide it immediately. Placement logic rejected during the prototype must not
  be carried into production.

### Parameter access

The five pages plus direct controls account for every one of the selected oscillator's
22 parameters. Wavetable, Mute, Solo, Warp Mode, and Voices are direct. Index and Warp
are also directly manipulated on the graph, and Semitone is also a direct shortcut;
their page readouts bind the same underlying endpoints. The complete placement contract
is in the [focused oscillator feature specification](./MOBILE_VOICE_FOCUSED_OSCILLATOR_SPEC.md).

The five shared Voice/filter parameters remain reachable above or adjacent to the
focused editor and are not mixed into its per-oscillator page count. Articulations
remain a separate authoring workflow.

## Consequences

- The selected oscillator gets enough width for a legible, instrument-like wavetable
  while every oscillator parameter remains reachable within five shallow pages.
- Cross-oscillator comparison requires tab changes. The letter-only tabs and per-tab
  page memory minimize the cost, but this is an intentional tradeoff.
- Detailed base/range feedback becomes transient during a drag rather than permanently
  consuming vertical space. The rail preserves glanceable state when the HUD is absent.
- Voice readouts intentionally use horizontal-base/vertical-modulation movement while
  existing FX knobs retain their accepted vertical-base/horizontal-modulation mapping.
  They share artwork and route semantics, not an input controller.
- The wavetable graph and numeric readouts share one parameterized rolling
  dominant-axis classifier. Their value projections differ: graph-horizontal edits
  Warp and graph-vertical edits Index, while readout-horizontal edits base and
  readout-vertical edits modulation. One movement sample changes one authority on both
  surfaces.
- Keeping graph-axis ownership behind one projection seam preserves the option to test
  X-to-wavetable switching later without disturbing Y/Index, endpoint ownership, or the
  real wavetable renderer.
- Aggregate Tune needs an explicit projection adapter so Octave, Semitone, and Fine do
  not misrepresent the shared modulation target.
- The gesture classifier, scroll ownership, range projection, and HUD are production
  interaction infrastructure, not CSS-only prototype behavior. They require pure logic
  tests and real mobile browser acceptance.
- The compact desktop/web Voice surface and native iPhone Voice surface must consume
  the same page manifest, projection rules, and gesture state machine so the behavior
  cannot diverge between shells.

## Relationship to earlier decisions

- This ADR supersedes ADR-017 only for compact Voice's oscillator composition, the
  four-knob underlay, and its previously deferred wavetable-control placement.
- ADR-017 remains authoritative for the Voice/FX/Mod accordion, sticky keyboard, FX
  controls, long-press parameter menu, and no-LFO product model.
- ADR-018 remains authoritative for explicit route creation, selected-route-only
  presentation, zero/unmapped/bypassed states, and the distinction between source
  selection and drag source.
- ADR-019 remains authoritative for the global armed modulation source and mobile
  source context.
- ADR-021 remains authoritative for the 22-control oscillator schema and for tab/page
  selection being presentation state rather than sound state.
- ADR-023 remains authoritative for live route amount reads and writes through
  `useModulationRouteAmountBinding`.

## Rejected alternatives

- Three simultaneous A/B/C cards were rejected because comparison did not justify the
  width lost to repeated identity, borders, and condensed graphs.
- A lower secondary-control drawer was rejected because it recreates the hidden,
  below-the-fold hierarchy this work is meant to remove.
- Large cards, gradients, rounded containers, a wide oscillator identity column, and a
  separate Mute button were rejected as nonfunctional space.
- Stacked label-over-value fields and permanently visible mini sliders were rejected as
  too tall and too hard to scan at phone width.
- A base fill in the bottom rail was rejected because it reads like a second range. A
  single base tick plus a modulation band communicates the two quantities directly.
- Locking one direction until release was rejected. Users must be able to steer from
  base to modulation or back within one touch while still changing only one value at a
  time.
- Simultaneous Warp and Index edits from diagonal graph movement were rejected. The
  graph must use the same rolling one-axis-at-a-time behavior as the numeric controls.
- Adaptive HUD placement near the control or finger was rejected after it allowed the
  finger to cover the HUD during upward movement. The fixed top-center placement is the
  product rule.
- Toolbar page swiping was rejected because the horizontal gesture is already the base
  editor. Dedicated paddles are unambiguous.
- Switching wavetables with the graph's X axis is deferred rather than rejected. The
  current cutover keeps explicit picker selection and uses X for Warp so one gesture
  cannot both load a different table and edit that table's shape.

## 2026-08-18 amendment: final-prototype visual decisions

The final interactive prototype (design canvas "Voice Wavetable Prototype")
settled these deltas, which supersede the corresponding text above:

- **The quick strip is dissolved.** Semitone is the bottom-right and Unison
  Voices the bottom-left overlay chip on the wavetable graph, using the same
  compact glass treatment as the Wavetable and Warp Mode overlays. Both remain
  direct detented controls with the readout gesture contract.
- **Solo is a per-tab badge.** Each A/B/C tab carries a DAW-style "S" in its
  top-right corner: yellow outline when off, solid yellow fill when on. Every
  oscillator's Solo is directly reachable without selecting it. There is no
  separate Solo button.
- **The graph and its parameter toolbar are one painted unit.** The
  renderer's background gradient (`#4b164f → #1f4f5c`, previously hardcoded
  inside the draw routine) is painted once by the page behind both the graph
  and the toolbar; the renderer's own background fill and its in-canvas
  frame/warp caption are disabled on this surface through explicit options
  that default to the unchanged desktop drawing.
- **ADR-025 owner-accent coloring applies to the HUD knob.** The base pie,
  handle, and base-mode chrome wear the Voice identity color; the outer ring
  wears the selected source color; grey is reserved for bypassed/unavailable;
  armed-but-unmapped is a source-colored dotted ring; a mapped route keeps a
  presence dot even at 0%.
- **Compact value formatting.** Toolbar and overlay cells render units
  without a space (`-12.4dB`, `+7st`) so dense cells cannot collide; the HUD
  and accessibility text keep full formatting. Readout cells are separated by
  small gaps with a faint one-pixel border and a one-pixel corner radius.
- **The Level short label is `Lvl`.**

The five shared Voice/filter parameters remain reachable through the retained
filter card and the compact Controls card (Play Mode and Glide); the
prototype's four-column shared strip was not carried into the cutover.

## 2026-08-18 amendment: live-review deltas

Device review of the integrated build settled these behavior deltas, which
supersede the corresponding HUD and rail text above (spec §10/§12 messages
included):

- **The HUD never renders message strings and never shifts layout.** The
  "create a mapping" and "route bypassed" helper texts are dropped. The HUD
  header is a fixed three-column grid (value left, name center, source right)
  so no content change can move any element. The Low/High span labels render
  only when the selected route has a non-zero amount — there is no modulation
  range to depict otherwise.
- **A vertical drag without an editable route stays in the base
  presentation.** The HUD only flips to the modulation presentation when the
  drag can actually write a route amount; otherwise the gesture presents (and
  behaves) as an inert base-value inspection, not an empty MOD view.
- **The base fill zero-anchors only for symmetric bipolar ranges.** Pan,
  Octave, Semitone, and Fine fill outward from center; asymmetric signed
  ranges such as Level (−60..+6 dB) fill from their minimum so the pie reads
  as an amount.
- **Mapped-route presence is visible on graph overlay chips.** A chip whose
  parameter has a route for the armed source shows a small dot in the source
  accent (outlined instead of filled when the route is bypassed), matching
  the rail-band language of the toolbar cells.
- **Modulation amounts on detented pitch parameters get sticky detents.**
  Semitone-kind route amounts drag freely but capture to whole semitones
  within ±0.2 st, with one haptic pulse per newly captured integer. Base-axis
  detents are unchanged.

## 2026-08-18 amendment: one MOD destination, one presenting cell

Device review exposed that mapping a source to pitch lit Octave, Semitone,
AND Fine on the Tune page. The engine has exactly one pitch modulation
destination (semitones); presenting the same route on three cells read as
three independent mappings. Superseding the aggregate-Tune trio text above:

- **Every engine MOD destination is presented by exactly one cell.** The
  manifest enforces this invariant at load. Semitone alone presents and
  receives pitch modulation (toolbar cell and graph overlay chip are the same
  control); Octave and Fine are base-only cells — no rail track, no route
  band, no drop target, inert vertical axis.
- The Semi cell's MOD HUD keeps the aggregate Tune presentation: base is
  octave·12 + semitone + fine/100 and travel is expressed in semitones over
  the ±61 st tune domain.
- The desktop noncompact knob deck follows the same rule: SEMI alone carries
  the pitch modulation ring and drop target; OCT and FINE are base knobs.

The same review found the amp modulation range defect (upward travel frozen
at base + 6 dB). That fix is engine-wide, not ADR-024-scoped: route amounts
for `ampGainDb` are additive dB offsets spanning ±54 (the full −48..+6
parameter span), and the engine clamps base + offset to the parameter domain
at application, matching every sibling destination.
