# Mobile Voice focused oscillator editor — feature specification

Status: implementation-ready product specification — 2026-08-18; graph X binding provisional

Decision authority: [ADR-024](./ADR-024-mobile-voice-focused-oscillator-editor.md)

Related contracts: [ADR-017](./ADR-017-mobile-accordion-and-dual-ring-rack-controls.md),
[ADR-018](./ADR-018-explicit-mobile-modulation-workflow.md),
[ADR-019](./ADR-019-global-mobile-modulation-rail.md),
[ADR-021](./ADR-021-parameter-state-and-schema-ownership.md), and
[ADR-023](./ADR-023-canonical-route-amount-projection.md)

## 1. Feature outcome

Replace the current compact/mobile Voice oscillator section with the accepted Variant-D
focused editor. The finished surface must make the selected wavetable the dominant
instrument graphic, keep the most important oscillator actions direct, and provide
complete access to all 22 oscillator parameters without a tall control deck.

The defining interaction is a one-row parameter toolbar attached to the bottom of the
wavetable. Its readouts preserve glanceable base/modulation state in a four-pixel rail,
then expand into a fixed top-center precision HUD while the user scrubs.

This document specifies the production cutover. Prototype fixture values, the prototype
mock MSEG route, its research panel, phone chrome, and variant switcher are not product
requirements.

## 2. Scope

### In scope

- Compact Voice layouts in the responsive desktop/web shell and native iPhone shell.
- A/B/C selection, active-tab Mute behavior, muted presentation, and Solo.
- Direct Semitone and Voices shortcuts.
- Full-width wavetable graph with top-left Wavetable and top-right Warp Mode overlays,
  plus provisional rolling-axis X = Warp Amount / Y = Index editing.
- Five toolbar pages covering all remaining oscillator controls.
- Inline readouts, truthful base/modulation rails, exclusive-axis readout scrubbing, route-state
  presentation, and the precision HUD.
- Shared interaction/domain code needed to make both mobile shells behave identically.
- Touch, pointer, keyboard, accessibility, performance, and regression acceptance.

### Integration scope, not redesigned here

- The existing Voice/FX/Mod accordion and sticky keyboard remain as accepted.
- All five shared Voice/filter parameters must remain directly reachable: Play Mode,
  Glide, Filter Mode, Filter Cutoff, and Resonance. The compact shared strip may retain
  the prototype's four-column form by combining explicit Filter Mode selection with the
  Filter Cutoff cell. The existing detailed filter editor may remain downstream; this
  feature must not remove it.
- Articulations remain a separate authoring workflow and are not placed in oscillator
  parameter pages.
- Existing global modulation-source selection and explicit mapping creation remain the
  route context for this editor.

### Out of scope

- DSP, endpoint, automation-slot, preset, or modulation-document schema changes.
- A redesign of noncompact desktop Voice or of the global filter editor.
- New modulation targets for parameters that are not currently modulatable.
- Automatic route creation from a readout gesture.
- An all-oscillator overview, simultaneous A/B/C graphs, or oscillator reordering.
- Adaptive/finger-following HUD placement.
- Horizontal swipe navigation between parameter pages.
- Persisting the selected oscillator or page inside the patch/preset.
- Replacing the accepted FX knob gesture mapping.
- Switching wavetables with the graph's X axis in this cutover. That remains a deferred
  physical-use experiment, not a second shipped graph mode.

## 3. Canonical vocabulary

| Term | Meaning |
| --- | --- |
| Focused oscillator | The selected A, B, or C instance whose 22 controls are projected into the editor. |
| Direct control | A control outside the five toolbar pages because it is always visible or manipulated on the graph. |
| Parameter page | One named subset of oscillator controls rendered in the attached toolbar. |
| Readout cell | One compact, inline label/value control whose whole rectangle owns scrubbing. |
| Base tick | The single neutral rail marker for the current unmodulated parameter value. It is never a fill. |
| Modulation band | The selected real route's source-colored projected low-to-high travel around the base tick. |
| Armed source | The globally selected modulation source that supplies route context and source color. |
| Selected route | The one real route matching armed source and focused target. It is not the sum of routes. |
| Axis mode | `base` for horizontal motion or `modulation` for vertical motion during a readout gesture. |
| Graph-axis contract | The rolling one-axis-at-a-time wavetable gesture: horizontal edits Warp Amount and vertical edits Index, with in-gesture switching. |
| Precision HUD | The fixed top-center overlay that expands the active readout into the accepted knob/range grammar. |

Use **Index** as the product label for `framePosition` / Wavetable Position. `Frame N` is
a derived index against the selected wavetable's actual frame count, not a separate
parameter.

## 4. Information architecture

The compact Voice section is ordered as follows:

1. Shared Voice/filter strip.
2. Equal-width A/B/C oscillator tabs.
3. Focused-oscillator quick strip: Semitone, Voices, Solo.
4. Full-width wavetable graph.
5. Two graph overlays: Wavetable at top left and Warp Mode at top right. During graph
   editing, the top-left selector becomes the active Warp or Index readout.
6. Attached parameter toolbar below the graph: previous paddle, current page cells,
   next paddle.
7. Any retained shared/detailed Voice surfaces, including the detailed filter and
   Articulations entry.

There is no outer card around steps 2–6. They form one flat instrument surface bounded
by thin dividers. Phone-content padding must not inset the tabs, graph, overlay, or
toolbar from the Voice workspace edges. The focused surface must not use a large border,
gradient, drop shadow, or ornamental identity rail.

### Density envelope

The prototype's useful density is the starting envelope, not a pixel-locked art spec:

- tabs: approximately 38–44 CSS pixels high;
- quick strip: approximately 48–52 pixels high;
- graph: at least 132 pixels high at a 390-pixel viewport and allowed to grow when
  vertical space permits;
- graph corner controls: compact, readable, and at least 44 CSS pixels in effective
  touch area without reserving renderer height;
- toolbar: approximately 36–40 pixels high including the four-pixel rail.

The toolbar may not grow because a label wraps. Inline labels are abbreviated before
height is added. At 320 CSS pixels wide, no label/value pair, paddle, or overlay may
overflow or cause horizontal page scrolling.

## 5. Oscillator tabs and quick actions

### Tabs

- Render exactly three equal tabs with visible text `A`, `B`, and `C`; no semitone,
  voice count, On/Off caption, or other secondary text appears in a tab.
- An inactive tab tap changes only `selectedOscillatorID`.
- A tap on the active tab toggles the focused oscillator's existing Mute endpoint.
- The A/B/C tab row stays stationary while a selection change slides the focused editor
  beneath it horizontally. Selecting a higher-letter oscillator moves the outgoing
  editor left and brings the new editor in from the right; selecting a lower-letter
  oscillator does the reverse. A direct A-to-C or C-to-A selection follows that same
  letter order rather than inventing a wrap direction.
- The slide is a short visual confirmation because adjacent oscillator editors otherwise
  look nearly identical. It must not postpone binding the newly selected oscillator or
  block immediate input. This is a tap/keyboard-triggered transition, not permission to
  add horizontal swipe navigation. Reduced-motion removes the translation while keeping
  the selected-tab state change unambiguous.
- Active is indicated by the normal oscillator accent and a bottom edge marker. Muted
  is grey/desaturated. Active+muted remains visibly selected but grey.
- Muting does not disable controls or discard page state. The editor remains usable so
  a sound can be prepared silently.
- Use `role="tablist"`, `role="tab"`, `aria-selected`, and an action-specific accessible
  name: either `Select oscillator B` or `Turn oscillator A off/on`.
- Arrow-key tab movement selects without toggling Mute. Enter/Space on the already
  focused active tab performs the explicit Mute action.

### Quick strip

- Semitone and Voices each use the accepted compact direct-control treatment and bind
  `semitone` and `unisonVoices` for the focused oscillator.
- Semitone is integer-detented from -12 to +12 st and requests a best-effort haptic only
  when the integer changes.
- Voices is integer-detented from 1x to 8x.
- Solo is a dedicated upper-right button with `aria-pressed` and at least a 44-pixel
  effective touch target. There is no Mute button here.
- Switching tabs immediately rebinds all three controls. A pending gesture is cancelled
  before the binding changes.

## 6. Wavetable graph and integrated overlay

- Reuse the real `WavetableStageSection` drawing/data path; do not ship prototype SVG
  waveforms.
- The real drawing fills the complete graph rectangle and continues underneath the two
  corner overlays. Do not apply a measured top inset, reserve a control strip, create a
  dead band, stretch the waveform, or otherwise distort the retained renderer.
- Over drawable graph space, horizontal movement edits the focused oscillator's real
  Warp Amount binding and vertical movement edits its real Index / `framePosition`
  binding. Reuse the numeric controls' rolling dominant-axis behavior: begin pending,
  classify one axis, update only that value, and allow the active axis to switch during
  the same drag when contrary motion clearly dominates.
- Reuse the accepted starting calibration: 8 px touch / 4 px mouse or pen activation,
  1.3 initial dominance, 1.6 switch dominance, 4 px contrary-axis evidence, and a
  36 ms rolling direction window. On a switch, consume the switching sample, clear
  direction history, and discard orthogonal motion so neither value jumps or accrues
  diagonal debt. These constants may be tuned from device evidence without changing
  the behavior.
- Shape-page Warp and Index remain aliases for precise and accessible editing. Graph and
  readout paths must share the same bindings and host gesture ownership rather than
  mirror state.
- The X = Warp binding is provisional. Put graph-axis ownership behind one descriptor or
  projection seam so a later product decision can replace X with discrete wavetable
  switching without changing Y/Index, the renderer, or stored state. Do not ship a
  preference, hidden alternate mode, or simultaneous Warp/table behavior now.
- Overlay controls must not initiate either graph axis. Wavetable selection remains the
  explicit picker in the overlay for this cutover.
- Axis direction, sensitivity, and pickup are calibration values to settle with real
  phone evidence. Calibration may not swap the parameters owned by X and Y.
- At idle, the graph has exactly two persistent overlays:
  1. top left: current Wavetable name; tap opens the real catalog picker;
  2. top right: current Warp Mode; tap cycles to the next real mode.
- There is no permanent Frame or Index readout. Once the graph gesture classifies an
  axis, the top-left Wavetable control smoothly changes into `Warp …%` for horizontal
  editing or the canonically formatted `Index …` for vertical editing. An in-gesture
  axis switch smoothly replaces the readout with the other value. Release or cancel
  restores the Wavetable selector. Use a brief, restrained transition with no geometry
  change; reduced-motion may remove the transform while preserving the state change.
- The corner controls must remain readable over the drawing without becoming a third
  strip, separate card, or permanent obstruction.
- Wavetable choices come from the real catalog. Index uses the selected table's real
  position/frame data rather than the prototype's fixed 256 assumption.
- Warp Mode choices remain Off, Bend +/-, PWM, Asym +/-, and Mirror. Warp Amount remains
  on the Shape toolbar page as an alias of the provisional graph-X binding.

## 7. Complete parameter placement

The manifest must be authored once and expanded through
`OSCILLATOR_BINDING_CONTRACTS`; it must not contain copied A/B/C endpoint tables.

| # | Product control | Base endpoint/control | Range or choices | MOD target | Production placement | Interaction |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Wavetable | `wavetableSelect` | catalog 0–237 | none | graph overlay | picker; graph-X switching deferred |
| 2 | Index | `framePosition` | 0–1 | `wavetablePosition` | graph Y + Shape alias | graph drag / readout |
| 3 | Warp Mode | `warpMode` | Off, Bend +/-, PWM, Asym +/-, Mirror | none | graph overlay | cycle/menu |
| 4 | Warp | `warpAmount` | 0–1 | `warpAmount` | graph X + Shape alias | graph drag / readout |
| 5 | Pan | `pan` | -1–1 | `pan` | Tune | readout |
| 6 | Octave | `octave` | -4–4 integer | aggregate `pitchSemitones` | Tune | detented readout |
| 7 | Semitone | `semitone` | -12–12 integer | aggregate `pitchSemitones` | quick strip + Tune alias | detented direct/readout |
| 8 | Fine | `fineCents` | -100–100 ct | aggregate `pitchSemitones` | Tune | readout |
| 9 | Level | `volumeDb` | -48–6 dB | `ampGainDb` | Shape | readout |
| 10 | Mute | `mute` | off/on | none | active tab second tap | toggle |
| 11 | Solo | `solo` | off/on | none | quick strip upper right | toggle |
| 12 | Voices | `unisonVoices` | 1–8 integer | none | quick strip | detented direct control |
| 13 | Detune | `unisonDetune` | 0–1, shown 0–50 ct | `unisonDetune` | Shape | readout |
| 14 | Blend | `unisonBlend` | 0–100% | `unisonBlend` | Unison | readout |
| 15 | Width | `unisonWidth` | 0–100% | `unisonWidth` | Unison | readout |
| 16 | Phase | `phase` | 0–100% | none | Phase | base-only readout |
| 17 | Random | `phaseRandom` | 0–100% | none | Phase | base-only readout |
| 18 | Phase Mode | `retrigger` | Free/Reset | none | Phase | choice cell |
| 19 | Detune Mode | `unisonDetuneMode` | Linear, Super, Exp, Inv, Random | none | Modes | choice cell |
| 20 | Stack | `unisonStackMode` | Off, 12, 12+7, Center-12, Center-24 | none | Modes | choice cell |
| 21 | WT Spread | `unisonWavetablePositionSpread` | 0–100% | `unisonWavetablePositionSpread` | Unison | readout |
| 22 | Warp Spread | `unisonWarpSpread` | 0–100% | `unisonWarpSpread` | Unison | readout |

This table contains 22 distinct controls. Index, Warp, and Semitone are intentional
aliases in two locations and must share one binding each. A manifest-coverage test must
fail when a control is missing, appears in two non-alias locations, or points at the
wrong MOD target.

### Toolbar pages

| Page | Cells, left to right | Cell count | Notes |
| --- | --- | ---: | --- |
| Shape | Index, Warp, Level, Detune | 4 | highest-frequency timbre/mix controls |
| Tune | Octave, Semitone, Fine, Pan | 4 | Oct/Semi/Fine share one Tune route |
| Unison | Blend, Width, WT Spread, Warp Spread | 4 | Voices stays direct |
| Phase | Phase, Random, Phase Mode | 3 | first two are base-only; last is discrete |
| Modes | Detune Mode, Stack | 2 | both are discrete choice cells |

- The previous paddle contains a left chevron and current page name; the next paddle
  contains the page count and right chevron. Both stay in the same toolbar row.
- Previous from Shape wraps to Modes; next from Modes wraps to Shape.
- Each oscillator remembers its current page for the UI session. Selecting another
  oscillator restores that oscillator's remembered page.
- Page transitions may slide/fade but cannot delay input. `prefers-reduced-motion`
  removes the transition.
- There is no toolbar swipe recognizer. Horizontal movement inside a readout always
  belongs to base editing.

## 8. Readout cell contract

### Static presentation

- Label and formatted value occupy one row. Label is left aligned; value is right
  aligned in tabular/monospace numerals.
- The approved short labels are `Idx`, `Warp`, `Level`, `Det`, `Oct`, `Semi`, `Fine`,
  `Pan`, `Blend`, `Width`, `WT`, `Warp`, `Phase`, and `Random`. Use the full accessible
  label regardless of visual abbreviation.
- There is no slider thumb, knob, second value row, or large top/bottom padding.
- The four-pixel rail is attached to the cell's bottom edge. It is part of the cell,
  not a second row.
- Focus, pending, base-edit, and modulation-edit states are visible without changing
  geometry.

### Formatting

| Kind | Examples |
| --- | --- |
| normalized/amount | `38%`, `0%`, `100%` |
| Level | `-7.8 dB` |
| Octave | `-1 oct`, `0 oct`, `+2 oct` |
| Semitone | `-12 st`, `0 st`, `+7 st` |
| Fine/Detune | `-3 ct`, `22 ct` |
| Pan | `22 L`, `C`, `18 R` |
| Voices | `1x`, `4x`, `8x` |

Formatting and parse/step behavior must come from shared descriptors where they already
exist. The toolbar must not create a second set of endpoint ranges or defaults.

### Tap and long press

- A tap without crossing drag activation selects the parameter as the current MOD
  target. It does not reset the value and does not create a route.
- A stationary long press uses the accepted parameter menu for exact entry, base reset,
  and applicable route actions. Movement past slop cancels long press.
- Do not add double-tap reset.
- A discrete choice cell uses tap for its choice action; it does not enter the two-axis
  readout controller.

## 9. Rail semantics

### Geometry

Normalize the current base value through the parameter's display range and draw exactly
one two-pixel neutral tick at that position. Do not draw a neutral fill from minimum,
zero, center, default, or any other origin.

For the selected route, compute the full low/high parameter result across that source's
legal unipolar or bipolar excursion, apply the target's real modulation law, clamp to
the target range, then normalize both ends into the same rail coordinate system. Draw
the interval between them in the armed source color. This is projected travel, not the
source's instantaneous value and not a sum of routes.

### Required states

| State | Rail |
| --- | --- |
| No armed source | neutral track + base tick; no modulation color |
| Armed source, target not modulatable | base tick only; no mapping affordance |
| Armed source, no route | base tick + faint neutral/dotted route track; no source-colored band |
| Existing route at 0 | base tick + visible source-colored zero marker so mapped is not confused with unmapped |
| Existing nonzero route | source-colored low/high band + neutral base tick |
| Existing bypassed route | same geometry, dimmed/dashed; editing amount does not enable it |
| Nonzero route fully clipped | source-colored marker at the clipped boundary; mapping must not disappear |

Source color comes from the approved source catalog. Target-selection styling remains
separate from source color.

### Aggregate Tune projection

Octave, Semitone, and Fine are three base endpoints but one MOD target. Their static tune
base is:

`tuneBaseSemitones = octave * 12 + semitone + fineCents / 100`

All three cells therefore project the same selected Tune route. The route amount and
HUD Low/High are expressed in semitones. The rail uses the aggregate static tune domain,
not a fake octave-only, semitone-only, or cents-only route. Horizontal edits and the
readout's center/base value remain in the cell's component units; on vertical intent the
HUD label changes to `Tune` and presents aggregate semitone values.

The implementation must provide an explicit target projection adapter for this case.
It may not reuse a generic component-local normalized range and call the result Tune.

## 10. Readout gesture state machine

### Product mapping

- `clientX` delta: base. Right is positive; left is negative.
- inverse `clientY` delta: modulation. Up is positive; down is negative.
- One movement sample can update only one authority.

### States

1. `idle`: no owned pointer.
2. `pending`: primary pointer is down, scroll is owned, no value has changed, and the
   classifier waits for activation/dominance.
3. `base`: horizontal segments update the base binding.
4. `modulation`: vertical segments update the canonical selected route amount.
5. `finishing`: bindings and listeners close exactly once, then return to `idle`.

### Classification

- Use an 8 CSS-pixel touch activation radius and 4-pixel mouse/pen radius as initial
  defaults. Movement inside it is a tap/long-press candidate.
- Initial classification requires clear dominance, starting at a 1.3 ratio. Ambiguous
  diagonal motion remains pending rather than changing both values.
- After activation, keep a short rolling direction window. The prototype's 36 ms
  window, 1.6 switch-dominance ratio, and 4-pixel contrary-axis evidence are accepted
  starting constants and must be device-tested before release.
- When contrary motion clearly dominates, close the old axis owner, switch mode, clear
  direction history, and consume the switching sample without applying it. The next
  samples edit the new axis. Release is not required.
- Apply only the selected component of each subsequent movement. Discard the other
  component immediately; it must not become stored delta or later "debt."
- Use coalesced pointer samples when available, but coalesce authoritative writes and
  HUD/rail painting to at most one update per animation frame while preserving the full
  integrated delta.

The numeric classifier constants are calibration values, not permission to change the
mapping or reintroduce release-locked direction. Release acceptance is behavioral:
ordinary diagonal hand jitter changes one value, deliberate turns switch promptly, and
no switch jumps.

### Value ownership

- On entry to `base`, begin the real parameter host gesture. On switch away or finish,
  end it exactly once. Switching back begins a new base host gesture.
- Base values pass through the canonical parameter coercion, step, and clamp. Integer
  detents fire at most one haptic per newly crossed value.
- On entry to `modulation`, resolve the armed source/focused target pair. If a real route
  exists, write through `useModulationRouteAmountBinding`. Do not read the live value
  from `useModulationState` and do not keep a control-owned optimistic amount.
- Route amounts use the target's signed amount bounds and step. Up/down movement can
  cross zero. Polarity affects projection, not whether signed amount editing is legal.
- If no armed source, no MOD target, or no route exists, vertical motion changes
  nothing. The HUD explains `SELECT MOD SOURCE`, `NOT MODULATABLE`, or
  `NOT MAPPED · CREATE MAPPING +` respectively. That message is noninteractive; route
  creation stays in the accepted explicit workflow.
- Editing a bypassed route changes its stored amount without enabling it.

### Sensitivity

- The starting base sensitivity is one full parameter range per 220 CSS pixels of
  horizontal travel.
- The modulation sensitivity must be expressed against each target's complete legal
  route-amount span; the prototype's 360-pixel vertical feel is the starting point.
- Detented parameters snap after continuous delta integration so slow reversals do not
  lose sub-step motion. There is no acceleration based solely on event frequency.
- Fine/coarse modifiers may be added for mouse/keyboard parity, but must not alter touch
  defaults without a separate interaction decision.

## 11. Touch and scroll ownership

- Apply `touch-action: none`, selection suppression, and callout suppression to the
  readout hit surface, not the entire Voice workspace at rest.
- On readout pointer down, call `preventDefault`, capture the pointer when supported,
  and install a non-passive capture-phase touch fallback for Safari.
- While active, lock the owning Voice scroller and root viewport at their start
  positions as a defensive fallback. Remove both locks on every finish path.
- Window-level pointer move/up/cancel listeners continue the gesture when capture is
  rejected or the pointer leaves the cell. Touch movement with `buttons === 0` remains
  live; only mouse uses zero buttons as an implicit release.
- `lostpointercapture` alone does not finish. It only transfers responsibility to the
  fallback listeners.
- `pointerup`/`touchend` finishes normally. `pointercancel`, `touchcancel`, window blur,
  hidden document, orientation/resize invalidation, tab switch, component unmount, and
  patch/session replacement cancel immediately.
- Cleanup is idempotent. It releases capture if still owned, ends any base host gesture,
  removes listeners/classes, cancels animation work, restores scroll, and hides or
  lingers the HUD according to the finish reason.
- A second finger or nonprimary pointer is ignored and must not replace the owner.
- Scrolling begun outside a readout stays ordinary page scroll. A readout gesture must
  never be promoted into page scroll midway through the drag.

## 12. Precision HUD

### Placement

- Render once in the mobile instrument shell's overlay layer, not inside the readout or
  scrolling Voice content.
- Pin to top center using the app viewport and safe-area inset. Starting geometry is
  approximately 236 by 188 CSS pixels, clamped to at least 8 pixels of side clearance.
- `pointer-events: none`; topmost app z-index; no layout participation.
- Its position is invariant from gesture activation through finish, including axis
  switches, scroll attempts, host echoes, and viewport-edge proximity.
- Do not port the prior adaptive side/above/finger-avoidance algorithm. It was rejected
  because it returned the HUD to the finger's path during upward drag.

### Content

The HUD contains:

1. Mode: `BASE ↔` or `MOD ↕`.
2. Full parameter label in base mode; canonical target label in modulation mode.
3. Armed source name and formatted signed route amount when a route exists.
4. The established FX dual-ring knob artwork.
5. Base value centered inside the knob.
6. `Low` and `High` projected range values at the corresponding arc ends.
7. Footer reminders: `↔ Base` and `↕ Mod amount`, with the active one emphasized.

Use the approved FX knob geometry, stipple, source colors, base/outer-ring separation,
zero-route presence, and bypass treatment. Extract/reuse its pure artwork/projection;
do not reuse the FX controller's vertical-base/horizontal-mod direction lock.

### Labels and units

- Base mode uses the exact field label and base units (`Semitone`, `-2 st`).
- Modulation mode uses the target label and amount units (`Tune`, `MSEG 1 · +7.0 st`).
- Low/High are target outputs after route projection and clipping, not route amount
  bounds and not the current instantaneous modulation value.
- A missing route/source or unsupported target replaces the source/amount line with the
  explicit state message; it never fabricates zero percent.

### Timing

- The HUD appears only after initial axis classification, so taps do not flash it.
- It updates without motion or positional jumps when the axis switches.
- Normal release lingers 300–500 ms; 420 ms is the starting value. A new gesture cancels
  an existing hide timer and reuses the fixed overlay.
- Cancellation, blur, hidden document, shell unmount, session replacement, and
  orientation invalidation hide immediately.
- Reduced motion removes scale/slide animation but may retain a brief opacity change.

## 13. Shared Voice/filter strip

The chosen prototype keeps high-value shared controls above the oscillator tabs. The
real surface must expose all five without pretending they are oscillator-local:

| Control | Range/choices | Requirement |
| --- | --- | --- |
| Play Mode | Poly, Mono, Legato | explicit current value and choice action |
| Glide | 0–2 s | direct compact edit |
| Filter Mode | Off, LP, HP, BP, Notch, Peak | explicit selector; may share the Filter cell |
| Filter Cutoff | 20–20,000 Hz | direct compact edit; existing filter graph remains valid detail |
| Resonance | 0.1–20 Q | direct compact edit |

If Filter Mode and Cutoff share one visual cell, both must have explicit, separately
accessible actions: a named mode selector/caret and a cutoff readout/gesture. Do not hide
mode cycling behind an unlabeled tap region. This shared strip is not part of the five
oscillator page positions and does not change their per-oscillator bindings.

## 14. State and architecture

### Authorities

| Concern | Authority |
| --- | --- |
| A/B/C parameter addresses and 22-control identity | `OSCILLATOR_BINDING_CONTRACTS` / generated product parameter contract |
| Current base values | live patch control bindings |
| Armed source and source color | accepted global modulation rail/source catalog |
| Route topology, source/target match, bypass, polarity | strict modulation domain/topology projection |
| Live selected route amount | `useModulationRouteAmountBinding` |
| Wavetable graph axis ownership | shared rolling-axis classifier plus graph projection: provisional horizontal = Warp, stable vertical = Index |
| Page and selected tab | local React presentation state |
| HUD visibility/axis/pointer | transient gesture state, never persisted |

### Required seams

- Define one oscillator-toolbar manifest keyed by `OscillatorControlID`. It owns page,
  order, short/full label, formatter, interaction kind, base binding projection, and
  optional MOD target reference. Endpoint range/default facts stay generated/shared.
- Implement the rolling-axis reducer and route-range projection as pure modules with no
  DOM or React dependency.
- Parameterize one pure rolling-axis classifier for both numeric readouts and the graph.
  The graph projection maps its horizontal mode to Warp and vertical mode to Index,
  while keeping the provisional horizontal binding replaceable without changing the
  classifier, Y/Index, or renderer code. It must never write both values for one sample.
- Build one shared readout/rail/HUD behavior consumed by the compact responsive Voice
  composition and native iPhone composition. Platform wrappers may supply bindings,
  safe-area geometry, and haptics; they may not clone the state machine.
- Extract the FX knob's pure SVG/art component or geometry into a reusable visual
  component. Keep `rack-parameter-knob`'s existing controller behavior unchanged.
- Keep the HUD in a shell-level overlay/portal so Voice scrolling and rerenders cannot
  reposition it.
- Route topology may be found through the broad projection, but amount display/write
  must subscribe directly to the route-specific binding. Do not make the root Voice
  component rerender on every route-amount sample.

Suggested module boundaries, names not binding:

- `mobile-voice-parameter-manifest.ts`
- `wavetable-graph-axis-projection.ts`
- `readout-axis-controller.ts`
- `parameter-route-projection.ts`
- `MobileVoiceParameterToolbar.tsx`
- `MobileVoicePrecisionHud.tsx`
- shared `ParameterKnobArtwork.tsx`

### Shell cutover

- Responsive `DesktopPatchView` replaces only its compact Voice oscillator composition;
  noncompact desktop remains unchanged.
- `IOSPatchView` must consume the same focused-editor view model and global armed-route
  context. If that context is not yet available in the native shell, supplying it is a
  prerequisite, not a reason to mock MSEG 1 or silently disable Y editing.
- The production implementation must never ship prototype hard-coded tables, mock
  modulation depths, fixed frame counts, or duplicated page state.

## 15. Accessibility and alternate input

- Every visible abbreviation has a full accessible name and current value.
- Readouts expose the base as an adjustable control with min/max/current value.
  Keyboard arrows edit base by its step; Shift+arrow may use the existing coarse/fine
  convention. Route editing and exact entry remain available through the selected
  target/parameter menu rather than requiring a diagonal pointer skill.
- Status changes (`BASE`, `MOD`, unmapped, bypassed) are available to assistive
  technology without announcing every pointer sample. Announce final committed values
  on release, not at display-frame rate.
- Choice cells expose current choice and operate with Enter/Space.
- Color is never the only distinction between base, mapped, bypassed, and unmapped;
  tick/band/dash/marker geometry carries state.
- Text and rail state must remain legible under increased contrast and system text-size
  settings without increasing the one-row toolbar height enough to overflow. Full names
  can remain in accessibility text while visual labels abbreviate.
- The fixed HUD must not cover the focused readout for ordinary phone geometry and must
  stay inside safe areas in portrait and landscape.

## 16. Performance and quality constraints

- An active scrub updates audio live and paints at display cadence. It must not trigger
  a full Voice/accordion rerender per pointer sample.
- Cache element geometry at pointer down. The move path performs no repeated layout
  measurement and no HUD placement calculation.
- Integrate all coalesced delta but commit at most once per animation frame. A final
  pending delta is committed before normal release.
- The route amount path must remain on the ADR-023 fine-grained subscription. Broad
  `modulation.v6` persistence may lag in React without making the cell or HUD lag.
- Overlay appearance must not cause cumulative layout shift. Opening/closing the HUD
  changes no page geometry.
- A muted oscillator edit, tab switch, page switch, source switch, patch echo, and
  route topology update must not leak listeners, host gestures, capture, timers, or
  animation frames.

## 17. Failure and edge-case behavior

| Situation | Required behavior |
| --- | --- |
| Finger moves diagonally before dominance | remain pending; change nothing |
| Motion changes from mostly X to mostly Y | end base ownership, switch in-place, then edit only route amount |
| Motion changes from mostly Y to mostly X | switch in-place, then edit only base |
| Finger leaves cell | continue through capture/window fallback |
| Browser fires `lostpointercapture` | continue; do not hide HUD or release ownership solely for this event |
| Safari touch move reports `buttons=0` | continue |
| Page attempts to scroll during owned drag | prevent and restore scroll position; HUD remains fixed |
| User starts scroll outside readout | allow normal scroll |
| No armed source | base works; Y is inert and HUD says `SELECT MOD SOURCE` |
| Armed but unmapped pair | base works; Y is inert and HUD says `NOT MAPPED · CREATE MAPPING +` |
| Route amount is exactly zero | show mapped source-color presence, not unmapped styling |
| Route is bypassed | show dashed/dim band; Y may edit amount but cannot enable route |
| Target is not modulatable | base works; no mod band; Y is inert and HUD says `NOT MODULATABLE` |
| MOD range clips at minimum/maximum | band clips and retains an edge marker |
| Host echo arrives mid-drag | authoritative binding remains source of truth; no visible snap from a stale broad projection |
| Selected source changes mid-drag | cancel current gesture, then rebind; never transfer the pointer to a different route |
| Oscillator/tab/page changes mid-drag | cancel exactly once before changing presentation |
| Patch/session replacement | cancel, clear HUD, and bind the new authoritative state |
| Blur, hidden document, rotation, resize, unmount | cancel immediately and remove every lock/listener |
| Second pointer arrives | ignore it |
| Readout is near screen edge | keep HUD top-center; do not adapt or follow finger |
| Reduced motion enabled | no page/HUD motion transform; behavior unchanged |

## 18. Risk register

| Risk | Why it matters | Mitigation / release gate |
| --- | --- | --- |
| Voice and FX use opposite axis mappings | Shared knob artwork could imply shared muscle memory when the controllers are intentionally different. | Keep the Voice HUD's `BASE ↔` / `MOD ↕` labels persistent during the gesture; do not change FX; include a cross-surface regression and device usability check. |
| Readout scrubbing feels indecisive or jumpy | Too much hysteresis makes turns lag; too little lets hand jitter switch values. | Keep the product rule fixed, tune only the documented classifier constants on real phones, and test L-, Γ-, and diagonal paths with value assertions. |
| Graph and readout classifiers drift | Both surfaces must feel like the accepted numeric controls even though they edit different authorities. Two reducers could diverge in activation, switching, or ignored-axis debt. | Share one parameterized rolling-axis classifier; give the graph its own Warp/Index value projection and contract tests. |
| Provisional graph X becomes hard-coded | A later X-to-wavetable experiment would require invasive renderer/UI changes and could disturb Y/Index. | Resolve graph axes through one descriptor/projection seam and prove that Y remains Index independently of the X binding. |
| The page steals or cancels a touch | A disappearing HUD or moving page makes the control unusable. | Own touch at pointer down, retain window fallbacks, treat lost capture as nonterminal, and require real WebKit lifecycle acceptance. |
| Rail/HUD imply a route that does not exist | This would violate explicit mapping and could alter sound unexpectedly. | Test every route state; route amount uses the canonical binding; Y is inert unless the exact selected route exists. |
| Tune projection lies about Octave/Semitone/Fine | These are three base controls but one MOD destination. | Use the explicit aggregate semitone adapter and target label; reject component-local fake projections in review/tests. |
| Dense cells become unreadable or untappable at 320 px | The space saving fails if labels wrap or hit targets become ambiguous. | Whole-cell hit regions, approved abbreviations plus full accessible labels, screenshot/interaction gates at four compact widths. |
| HUD is occluded again | Adaptive placement already failed during upward drag. | Shell-level fixed top-center portal, no move-time placement calculation, screenshot and pointer-path assertion that its coordinates never change. |
| Route edits rerender the entire Voice surface | Raw touch cadence could recreate the prior frame-starvation problem. | ADR-023 route-specific subscription, frame-coalesced writes, render-count/performance acceptance. |
| Responsive and native shells drift | Two independent copies would accumulate different pages, axes, and cleanup bugs. | Share manifest, classifier, projection, and HUD behavior; require both shells to run the same contract tests. |

## 19. Acceptance criteria

### Layout and access

1. At 320, 375, 390, and 430 CSS-pixel widths, tabs, graph, overlay, and toolbar are
   edge-to-edge with no horizontal overflow.
2. A/B/C tabs contain only letters. Selecting B changes the focused bindings; tapping B
   again toggles only B Mute and greys B without disabling its editor.
3. Changing from A to B or B to C leaves the tab row fixed and slides the focused editor
   left; changing in the opposite direction slides it right. The new oscillator accepts
   input immediately, reduced-motion removes the translation, and no swipe recognizer is
   created.
4. There is no dedicated Mute button or duplicate oscillator letter/power block. Solo
   remains visible at the upper right.
5. Semitone and Voices are available without changing toolbar pages.
6. Over drawable graph space, a horizontal-dominant segment changes Warp Amount and not
   Index; a vertical-dominant segment changes Index and not Warp Amount. A continuous
   L-shaped drag can switch Warp → Index → Warp without release, but no sample changes
   both and ambiguous diagonal jitter changes neither. Neither axis changes the selected
   wavetable in this cutover. Wavetable and Warp Mode overlays operate without starting
   either graph axis.
7. The real wavetable drawing fills the graph rectangle behind both corner controls,
   with no reserved control inset, dead band, stretch, or distortion. At idle, only
   Wavetable at top left and Warp Mode at top right persist. During graph editing, the
   top-left control smoothly becomes the current Warp percentage or Index value, tracks
   an axis switch, and returns to Wavetable on finish.
8. Page paddles, page identity/count, and parameters occupy one row. Pages wrap and are
   independently remembered for A/B/C.
9. The manifest-coverage test accounts for exactly the 22 controls in section 7 and all
   five shared parameters remain reachable.

### Readouts and rails

10. Every continuous toolbar cell keeps label and value on one line with no large empty
   vertical padding.
11. Every rail renders base as one neutral tick. No base-origin fill exists in DOM/CSS or
   screenshot output.
12. A mapped route renders only that selected route's source-colored projected band.
    No-source, unmapped, zero, mapped, bypassed, clipped, and non-modulatable fixtures
    are distinguishable.
13. Octave, Semitone, and Fine identify their Y-axis route as Tune and show semitone
    amount/Low/High values derived from aggregate static tune.

### Readout gesture behavior

14. A horizontal drag changes base and not route amount. A vertical drag changes the
    existing route amount and not base.
15. A single continuous L-shaped drag can change base, then route amount, then base
    again without release; no sample changes both and no switch jumps.
16. Ambiguous jitter inside activation/dominance changes neither value.
17. On real iOS WebKit, the drag never becomes page scroll, never terminates merely on
    lost capture, and the HUD remains visible until a real finish condition.
18. Releasing/cancelling outside the cell, blurring, hiding, rotating, and unmounting
    each end ownership exactly once with no stuck page lock.
19. A vertical drag with no route does not create a route, persist a draft, or display a
    false zero mapping. A bypassed route remains bypassed after editing.

### HUD

20. HUD appears only after axis classification and is fixed at top center for the whole
    gesture. It never moves back above the readout or follows the pointer.
21. HUD names the active axis, full parameter/target, actual armed source, signed route
    amount, center base, and projected Low/High with correct units.
22. Axis switches update content/art emphasis without moving the overlay.
23. Normal release lingers briefly; cancel/context loss hides immediately; the overlay
    never blocks pointer input.

### Data and performance

24. Base writes reach only the focused oscillator endpoint and respect its real range,
    step, begin/end gesture, and detents. Graph X writes only focused Warp Amount and
    graph Y writes only focused Index through their existing authoritative bindings.
25. MOD writes reach only `useModulationRouteAmountBinding` for the selected real route.
    A test fails if a live readout amount is driven from broad `useModulationState`.
26. A 10-second scrub at display rate produces no uncaught errors, stuck gestures,
    document scroll, layout shift, or root Voice rerender per raw pointer event.
27. Compact responsive and native iPhone shells pass the same pure manifest,
    classifier, projection, and lifecycle contract tests.

## 20. Verification matrix

| Layer | Required proof |
| --- | --- |
| Pure unit | page manifest completeness; shared rolling-axis classifier; graph projection with replaceable horizontal and stable vertical/Index; one-write-per-sample; format/step; aggregate Tune; route range/polarity/clipping; rail states; mode-switch/no-debt; idempotent finish |
| React/component | tab/Mute semantics; directional A/B/C editor slide with fixed tabs and immediate bindings; per-osc page memory; graph/Shape alias bindings; corner-overlay exclusion; top-left selector/readout transitions; HUD labels; route amount binding; no-route/bypassed states; reduced motion; accessibility roles |
| Browser | 320/375/390/430 screenshots; directional A/B/C transition and reduced-motion state; full-frame graph behind corner controls; no overflow; label/value alignment; exact base-tick rail; graph value transition; top-center HUD; pointer leaving control; outside scroll remains normal |
| WebKit touch | non-passive ownership; `buttons=0`; rejected/lost capture; pointer/touch cancel; blur/visibility; no mid-drag page scroll |
| Native iPhone | real safe area, orientation cancellation, haptics on Oct/Semi detents, global armed source integration, live audio response |
| Regression | desktop noncompact Voice unchanged; FX knob axes unchanged; explicit route creation unchanged; presets/parameters/schema unchanged |

Browser screenshots alone are insufficient for touch ownership. The release gate needs a
real WebKit touch path or the established iOS simulator/device harness, plus explicit
state assertions for base, route amount, scroll position, HUD visibility, and cleanup.

## 21. Implementation sequence

1. Add the canonical page manifest and coverage tests against the 22-control contract.
2. Add pure route projection, aggregate Tune projection, and rail-state tests.
3. Add the parameterized rolling-axis reducer and exhaustive lifecycle tests, including
   dynamic switching, one-write-per-sample, and ignored-axis debt.
4. Add the graph projection and lifecycle tests. Pin provisional horizontal = Warp /
   vertical = Index while proving horizontal can be replaced without changing the
   classifier, Index, or renderer ownership.
5. Extract the knob artwork from its FX controller without changing FX behavior.
6. Build readout, rail, toolbar, and shell-level HUD components against fake bindings.
7. Integrate the responsive compact Voice editor using real parameter bindings,
   global armed source, selected route topology, and route-specific amount binding.
8. Integrate the same behavior into `IOSPatchView`; do not fork the interaction.
9. Run responsive/component tests, real WebKit touch acceptance, iPhone build/install,
   and existing desktop/noncompact regression suites.

Do not start with CSS grafted onto the prototype. The pure manifest, projection, and
gesture contracts are the stability boundary; production composition follows them.

## 22. Decision register

### Settled product behavior

- Variant D focused hierarchy; letter-only tabs; active-tab Mute; Solo only.
- A/B/C tabs remain fixed while the focused editor slides left or right according to
  letter order; selection binds immediately, no swipe navigation is added, and reduced
  motion removes the translation.
- Full-frame graph behind top-left Wavetable and top-right Warp Mode overlays; no
  permanent Frame/Index display. The top-left control becomes the current Warp or Index
  readout during graph editing and returns to Wavetable on finish.
- Provisional graph axes: horizontal edits Warp Amount, vertical edits Index, using the
  numeric controls' rolling one-axis-at-a-time behavior. Graph-X wavetable switching is
  deferred and the current picker remains authoritative.
- Attached, compact five-page toolbar; inline label/value; no page swipe.
- Base tick plus selected-route modulation band.
- Readout X edits base; readout Y edits modulation; its rolling axis can switch before
  release while changing only one value per sample.
- Fixed top-center HUD using FX knob visual language and correct real labels/units.
- Explicit route creation only; selected-route-only display/edit.
- Complete 22-parameter access and direct Semitone/Voices shortcuts.

### Initial calibration values, tunable only through device evidence

- 8 px touch / 4 px pointer activation.
- 1.3 initial dominance; 1.6 switch dominance; 4 px switch evidence; 36 ms window.
- 220 px per full base range; approximately 360 px per complete route amount span.
- 420 ms normal HUD linger.
- Exact strip heights within the density envelope.

Changing these constants is calibration. Changing the readout axes, release behavior,
one-value-at-a-time exclusivity, fixed HUD placement, rail semantics, or route-creation
semantics is a product-decision change and requires updating ADR-024. The graph's X
binding is the separately recorded provisional exception: replacing Warp with wavetable
switching still requires product review and an ADR/spec update, but the implementation
must preserve that option behind the graph-axis seam.

### Deferred

- Simultaneous A/B/C comparison view.
- A separate redesign of the detailed global filter and Articulations navigation.
- New MOD destinations for phase, random phase, voices, or modes.
- Per-control velocity curves, touch pressure, inertia, or gesture acceleration.
- A new global gesture mapping that would make FX and Voice axes identical.
- Replacing provisional graph X = Warp with discrete wavetable switching after a
  physical-use comparison. No dual behavior or user preference is authorized yet.
