# Cosimo iOS UI Decision Ledger

Status: transcript-derived source of truth for review. Prototype implementation is
frozen while this ledger is reconciled. Do not treat a brainstorming statement as
settled when a later statement rejects or narrows it.

Scope: the complete core iOS sound-design experience, not only the Effects screen.

## How To Read This Ledger

This document accounts for all 80 user messages in the design session. References
such as `[U31]` point to the chronological message trace in the appendix.

Precedence rules:

1. A later explicit correction overrides an earlier proposal or prototype behavior.
2. A direct user decision overrides an assistant recommendation.
3. A terse approval (`yes`, `sure`, `sounds good`) accepts only the concrete proposal
   immediately under discussion, as reconstructed from the adjacent transcript and
   the accepted rack ADRs.
4. Brainstorming language (`maybe`, `I don't know`, `one way`) remains open unless it
   was later selected.
5. An implemented prototype behavior is not a decision merely because it exists.
6. Current implementation compliance is reported separately from the intended
   product contract.

Compliance labels used below:

- **PASS** — represented faithfully enough to evaluate.
- **PARTIAL** — some of the contract exists, but important behavior or fidelity is
  missing.
- **FAIL** — current behavior contradicts the accepted decision or has been rejected
  in review.
- **NOT PROTOTYPED** — decided, but not represented in the prototype.
- **OPEN** — intentionally unresolved.

## 1. Product Destination And Boundaries

### 1.1 The product is an iOS sound-design environment

- The destination is the core of Cosimo's whole mobile experience, specifically on
  iOS. It is broader than an Effects workspace and broader than a performance panel.
  `[U01] [U33] [U34] [U35]`
- The interface is optimized around sound design: repeatedly auditioning a sound,
  adjusting a base value, adjusting modulation, and immediately hearing the result.
  `[U01]`
- The complete UI must demonstrably satisfy
  `COSIMO_MOBILE_SOUND_DESIGN_UI_CONSTRAINTS.md`; that is part of the destination,
  not merely an input document. `[U34]`
- The current patch is the root working context. The user edits one patch at a time;
  patch/preset browsing and broader file management still need their own product
  definition. `[U37] [U38]`
- The same core mobile UI should be usable in standalone and AUv3 contexts unless a
  host constraint requires a documented variation. `[U35] [U37]`

### 1.2 The current prototype is parallel product work

- The prototype is not disposable HTML and is not yet the production iPhone UI. It
  is a parallel React product prototype intended to be ported into the real Cosimo
  iOS UI next. `[U77]`
- Work should move toward clean React components, stable domain identities, and a
  production adapter boundary instead of a giant page or ad-hoc DOM state. `[U77]`
- UI-session state—workspace, focused module, selected parameter, selected mapping,
  and shallow return context—belongs in the React/controller layer. Patch/runtime
  state must later come through a real Cosimo adapter. `[U77]`

Current status: **PARTIAL**. The prototype is React and componentized, but product
components still import prototype catalogs directly and the adapter contract does
not yet cover the real articulation bank, MSEG v2, source visibility, or production
parameter descriptors.

## 2. Foundational Sound-Design Loop

The ordinary loop must work without navigation:

1. Select or remain in the module being designed.
2. Trigger or retrigger a note using the current articulation.
3. Change the parameter's current base/edit-layer value.
4. Change the amount of a selected modulation mapping.
5. Retrigger and compare.
6. Repeat as rapidly as needed.

`[U01] [U31] [U40] [U42]`

Consequences:

- Every focused sound-design view needs practical audition controls. `[U01] [U31]`
- A base parameter, its mapping amount, and retriggering must coexist in the same
  working context. `[U01] [U31]`
- A design that makes the user navigate between base value and modulation amount is
  invalid. `[U31]`
- A design that displays an editor without a usable Trigger/retrigger is incomplete.
  `[U31]`

Current status: **PARTIAL**. The shell keeps audition controls present, but the
mapping-focus route can replace the module workspace and therefore breaks the
accepted co-editing model.

## 3. Focus, Navigation, And Workspace Structure

### 3.1 Focus is explicit and stable

- A focused oscillator, filter, effect, envelope, macro, or MSEG remains the focused
  editor until the user explicitly selects another module or source. `[U29]`
- Opening or editing a mapping never implicitly replaces its target module with the
  modulation source. If Filter is focused, Filter remains visible and operable.
  `[U29] [U31]`
- Parameter-first and source-first are two complementary user flows, not competing
  layout options. `[U29]`
- Explicitly tapping a source chip changes focus to that source editor. Editing the
  source's relationship from a target does not. `[U29] [U50]`

### 3.2 Known top-level workspaces are siblings

- Voice/Oscillator and Effects are sibling workspaces. A user must be able to reach
  the oscillator view directly from Effects. `[U49]`
- A dropdown is too hidden and difficult to access. The accepted switcher is a
  compact carousel/tab control: the selected workspace has a larger central icon,
  the previous and next workspaces remain visible as smaller icons, and the user can
  swipe through them. `[U58]`
- Each workspace should remember and restore its last focused module. This is
  session UI state, not patch state.
- The full workspace inventory beyond Voice and Effects remains open; the control
  must be extensible without inventing extra workspaces now.

### 3.3 Source-to-target navigation has a shallow return trail

- From `Envelope 1`, opening target `Wavetable · Warp` must show that target in its
  owning module and provide `Back to Envelope 1`. `[U60] [U62]`
- Returning restores Envelope 1's selected target and scroll position. `[U62]`
- Return labels are contextual; `Back to Phaser` must never remain hard-coded after
  the user arrived from Drive or another module. `[U50]`
- Switching the current articulation for audition/editing does not navigate away.
  A separate management surface may later handle articulation names, ordering, or
  trigger assignments. `[U39] [U40]`

Current status: workspace carousel **PASS directionally**; source return trail
**PARTIAL**; mapping-chip behavior **FAIL** because selecting a mapping currently
enters `MappingFocusEditor`, replacing the focused module.

## 4. Stable Page Geometry And Region Ownership

### 4.1 Working hierarchy

- After reserving compact persistent controls, the focused primary editor gets
  roughly the top two-thirds and one contextual secondary region gets roughly the
  remaining third. This is a hierarchy rule, not an inflexible pixel ratio. `[U42]`
- There may be many controls on screen; “two primary elements” does not mean only
  two DOM elements. `[U42]`
- The contextual secondary is task-dependent. Do not hard-code it as “whatever
  belongs to the last-touched parameter” in every workspace. `[U43]`
- When the focused module is an effect and a parameter is selected, its mapping
  relationships are the likely secondary content. Other modules may use the region
  differently. `[U43]`

### 4.2 Routine mapping selection must not move the page

- The early idea of a hidden panel that appears after tapping a mapping chip was
  explicitly rejected after testing. `[U31] [U74]`
- If mappings exist, the relationship region reserves a stable detail surface from
  the start. Tapping `MSEG 1 +62%` or `Pressure +18%` swaps the content of that same
  surface in place. It must not insert a new panel, change the primary/secondary
  boundary, or move the rest of the interface. `[U74]`
- Reselecting the already active mapping does not collapse the surface or cause a
  layout shift. `[U74]`
- With no mappings, the same reserved region may show a compact Add action and an
  intentionally designed empty state; it must not become accidental blank space.

### 4.3 A genuinely deep contextual editor is different

- Some compound or source editing may need more room than the bottom third. A full
  MSEG editor, for example, probably cannot fit there. `[U42]`
- An explicitly requested deep editor may take most of the workspace while the
  original module collapses to a compact live strip containing its identity,
  target parameter, and adjustable base value. Audition remains present, and
  dismissing restores the exact prior state. `[U43]`
- This deeper takeover is not the default response to tapping an ordinary mapping
  chip. The later no-layout-shift rule supersedes that earlier interpretation.
  `[U74]`

### 4.4 Space is earned, not padded

- Primary areas must use their available space. An envelope should not have a small
  graphic, separate redundant A/D/S/R sliders, and a large dead zone. Its stages can
  be edited in the graphic. `[U63]`
- Persistent compound controls such as Phaser Rate `Free / Sync / division` belong
  inside the graphic/editor surface and remain visible. They must not appear only
  when Rate is selected or create vertical shifts. `[U60]`
- Remove explanatory prototype labels such as `ORDERED EFFECTS — SCROLL`,
  `SOURCES — TAP TO EDIT`, and redundant `Depth mappings`. The layout must convey
  its own meaning. `[U58] [U59]`
- Live values must have reserved widths/tabular treatment so changing `48%` to a
  longer formatted value never pushes neighbors, overlaps a control, or changes
  geometry. `[U75] [U76]`
- Region borders have one owner. Adjacent regions must not produce doubled rules,
  inconsistent weights, or accidental seams. `[U75] [U76]`
- At phone widths there should be one intentional scroll surface per context, not
  nested accidental scrolling.

Current status: **FAIL**. The user observed panel insertion, overlaps, inconsistent
padding/rules, and value-driven layout movement in the current build. `[U74-U78]`

## 5. Direct-Manipulation Grammar

### 5.1 Scalar parameter control

Every compact scalar parameter control follows the same contract:

- **Tap** selects the parameter and changes the contextual relationship region.
- **Horizontal drag (X)** changes the current base/edit-layer value.
- **Vertical drag (Y)** changes the amount of the currently selected modulation
  mapping, if one exists.
- Exact values appear in the transient HUD while dragging.
- The control itself is the touch target; the user should not have to tap it first
  to reveal a separate slider. `[U50] [U51] [U53-U55]`

For a non-Default articulation, X edits or creates that articulation's sparse
absolute override for an eligible voice parameter. Default articulation edits the
patch base. `[U46]`

### 5.2 Tapping is not a request for a bigger scalar slider

- For an ordinary scalar such as Drive Amount, tapping primarily selects its
  modulation context. There is no justified product use case for revealing a
  larger duplicate slider above it. `[U53-U55]`
- A compound parameter may expose persistent parameter-specific controls—e.g.
  Rate's Free/Sync and rhythmic division, Delay timing mode, or another discrete
  sub-setting—but this is not a generic “expanded scalar” pattern. `[U55] [U60]`
- If future parameter types genuinely contain more information or controls, define
  that type explicitly rather than turning every scalar into an expandable card.

### 5.3 Source target rows use the same grammar

- In `Envelope 1`'s target list, the `Wavetable · Warp` compact row is directly
  editable: X changes Warp's current base/edit-layer value and Y changes Envelope
  1's amount to Warp. `[U50] [U51]`
- The row also has a distinct open-target action so navigation is intentional.
  `[U60]`
- Selecting one target may reveal its relationship-only settings (polarity,
  reducer when required, remove) within a stable target-list region; it does not
  replace Envelope 1 merely because the mapping was touched.

### 5.4 Mapping chips are controls

- A mapping chip includes source identity and its signed amount, e.g.
  `MSEG 1 +62%`. `[U59]`
- Vertical drag on the chip adjusts the amount immediately and drives the global
  transient value HUD. The user need not open the detail card for ordinary amount
  adjustment. `[U59]`
- Tap selects that relationship and swaps the fixed detail surface to polarity,
  reducer if applicable, remove, and source navigation. `[U59] [U74]`
- The chip's direct gesture is not replaced by a conventional visible amount
  slider. A detail control may exist as a secondary affordance only if it does not
  displace or obscure the established chip gesture. `[U79]`

### 5.5 Primary graphics are controls

- The module graphic is a direct-manipulation surface, not decoration. `[U02] [U42]`
- Wavetable example: vertical motion scans frames/index; horizontal motion changes
  warp/bend. `[U42]`
- Phaser, Filter, Drive, Delay, Reverb, and similar modules need real line-art/data
  graphics rather than instructional placeholder text. `[U59]`
- Envelope/MSEG stages and levels should be manipulated in the shape where possible,
  reducing the need for separate sliders. `[U63]`

### 5.6 Gesture feedback

- Axis locking must make X-versus-Y intent predictable.
- Gesture cancellation must not commit an unintended edit.
- Haptics are strongly desired for axis lock, source lift, entry into a valid drop
  target, successful mapping, rack lift, and rack snap. `[U62]`
- Do not impose a blanket rule that every custom interaction gets a conventional
  alternate control. Such alternates may be chosen individually when requested;
  the blanket recommendation was rejected. `[U62]`

Current status: **FAIL as experienced**. Some handlers remain in code, but the user
reports that the visible product regressed to sliders and no longer communicates or
preserves the established X/Y and chip-drag interactions. `[U79]`

## 6. Value, Layer, And Identity Representation

### 6.1 Avoid permanent numerical overload

- The interface should feel simple and elegant despite deep control. Prefer a fill,
  handle, tick, range, curve, or movement graphic to a permanent number when the
  graphic communicates the value. `[U43]`
- Numbers are not forbidden. They remain appropriate for precision, discrete
  choices, compact secondary controls, and situations where a graphic would consume
  too much space. `[U44]`
- Do not commit the entire product to knobs. A Phaser can have five or more
  parameters; primary parameters may receive more tactile/graphic treatment while
  secondary parameters use compact readouts or tracks. `[U44]`

### 6.2 One compact parameter may need to express three layers

For an eligible parameter, the visual system must distinguish:

1. patch base/default value;
2. the active articulation's sparse absolute override, if any;
3. the selected modulation relationship and amount.

`[U45]`

Accepted representation direction:

- current/effective edit-layer position: primary handle/fill;
- inherited patch base or parameter default: quieter reference tick/marker;
- selected modulation: source-colored range/rail extending from the effective
  value;
- articulation override: the articulation's small icon and semantic color placed
  subtly near only the overridden control;
- exact number: transient HUD during manipulation rather than three permanent
  numerical readouts. `[U43] [U45] [U46] [U63]`

### 6.3 Transient value HUD is a global interaction contract

- Every continuous change—module graphic, compact parameter, rack quick control,
  mapping chip, mapping detail, source target row, or source editor—feeds the same
  top-of-screen heads-up readout. `[U43] [U60]`
- The HUD appears when dragging begins, shows label plus formatted value, remains
  visible around the finger rather than under it, and becomes visually silent when
  idle without changing layout. `[U43]`

## 7. Parameter-First Modulation Flow

Example: Phaser is focused and Frequency is selected.

- Phaser and its graphic remain the primary editor. `[U29]`
- Frequency's base/effective layer remains directly editable. `[U31]`
- The relationship band shows assigned sources as compact amount-bearing chips,
  e.g. `MSEG 1 +62%`, `Pressure +18%`, and `+`. `[U31] [U59]`
- One stable detail surface is always allocated when relationships exist. It shows
  only the selected relationship's deeper settings. `[U74]`
- Amount is editable directly on each chip; detail is for polarity, the conditional
  reducer, remove, and opening the source. `[U59]`
- Add Source creates a stored mapping from this target side.
- The audition footer remains available throughout. `[U31]`

This flow answers: **What is moving this parameter, and by how much?**

## 8. Source-First Modulation Flow

Example: the user explicitly taps Envelope 1 in the source shelf.

- Envelope 1 becomes the focused editor, with its real source-specific graphic and
  controls. `[U29] [U50]`
- The contextual region shows Envelope 1's actual targets, not a hard-coded fixture
  shared by every source. `[U50]`
- Each target row shows target identity, current base/edit-layer value, Envelope 1
  amount, and conditional relationship settings. `[U50]`
- Rows are directly editable with X base / Y Envelope 1 amount. `[U50] [U51]`
- An explicit open-target action enters the target module with a shallow return path.
  `[U60] [U62]`
- `+ Target` creates the same mapping model as `+ Source`, approached from the source
  side.
- The source shape remains visible while its target relationships are edited.

This flow answers: **What does this source control, and by how much?**

## 9. Mapping Data And Reducers

- A mapping has stable source identity, target identity, amount, polarity, and a
  reducer only when its processing-domain crossing requires one.
- Voice/per-note sources targeting a global effect require an explicit per-mapping
  reducer. The UI must not silently invent a global MPE behavior. `[U05] [U07-U10]`
- V1 reducer algorithms are exactly **Maximum** and **Mean**. Maximum is the default.
  More algorithms are rejected until a concrete musical use case appears. `[U10]`
- Reducer is controllable per mapping, not one synth-wide preference. `[U07-U10]`
- Reducer UI appears only for a voice-domain source mapped to a global destination.
  It stays hidden for mappings such as a per-note envelope to a per-note wavetable
  parameter. `[U62]`
- Continuous effect parameters, including Mix/Wet, can be modulation destinations.
  Rack order, effect enabled state, and discrete mode/algorithm selectors cannot.
  `[U23]`

## 10. Modulation Source Shelf

### 10.1 Inventory and progressive disclosure

- Four patch-global Macros are reserved. A new patch initially shows Macro 1 plus
  Add; additional macros appear only when created. `[U20] [U21]`
- Three Envelopes and three MSEGs are reserved with the same `1 + Add` disclosure
  pattern. `[U21]`
- There is no separate LFO family. Looping/repeating modulation belongs to MSEG.
  `[U22]`
- Velocity, MPE Pressure, and MPE Slide are fixed voice-domain sources in the v1
  source inventory.
- Macros are patch-global, normalized, renameable, host-automatable sources that may
  fan out to multiple continuous targets. They are not destinations in v1.
- Unused reserved slots are not shown as disabled controls. `[U21]`

### 10.2 Shelf presentation

- Persistent shelf items use simple source-family icons plus slot number; remove
  long repeated words such as `Macro`, `Envelope`, and `MSEG` from the compact bar.
  `[U50] [U51]`
- Source identity color appears as a restrained glyph/underline/rail, not a broadly
  colored card. `[U63] [U64]`
- A source with no targets is visually muted/greyed as an orphan. `[U62]`
- A badge at the upper right shows how many targets the source controls. Slot number
  and attachment count must remain visually distinct. `[U62]`
- Source chips keep stable slot order. The user did not request source-chip
  reordering. `[U62]`

### 10.3 Source actions

- Tap opens the source editor explicitly.
- Drag starts a mapping assignment. As soon as the drag begins, every eligible
  parameter target becomes visibly droppable and ineligible/already-mapped targets
  quiet down. `[U62]`
- Dropping creates a mapping or focuses the existing mapping rather than duplicating
  it. Haptics confirm lift, valid-target entry, and drop. `[U62]`
- Long press opens source management, including rename where supported and Delete.
  Delete communicates how many mappings will be removed and offers Undo. `[U60]`
- Removing a source frees its reserved slot for later reuse.
- Tapping the source preview inside a relationship detail opens the same source
  editor as tapping its shelf chip. `[U59]`

Current status: **PARTIAL**. Macro/Envelope/MSEG progressive chips, counts, deletion,
and drag targeting exist directionally. Velocity and Slide, macro rename, complete
management behavior, and production active-slot state are missing.

## 11. Articulation Model And UI

### 11.1 Accepted product model

- Articulations use **sparse absolute overrides**, not relative offsets. `[U39] [U40]`
- A parameter absent from an articulation inherits the Default patch base and follows
  later Default changes. A parameter present in an articulation stores an absolute
  value and remains stable when Default changes. `[U40]`
- While a non-Default articulation is active, manipulating an eligible voice
  parameter creates or edits that articulation's override. To edit patch base, use
  Default articulation. `[U46]`
- Every overridden parameter is always visually identifiable and has a
  parameter-level action to clear/reset only that override. `[U40]`
- Each articulation gets a unique semantic color and compact icon. The icon appears
  subtly near controls that actually have an override; do not put a loud icon on
  every parameter. `[U62] [U63]`
- The current articulation remains visible beside audition controls and can be
  switched without leaving the editor. `[U40]`
- `Default articulation` means audition/edit the Default layer; `Clear <articulation>
  override` resets one parameter. Do not conflate those actions.
- Global effects base values are patch-owned and are not sparse per-articulation
  overrides. Articulations affect global effects only through explicit mappings and
  reducers.

### 11.2 Production reconciliation still required

The real `articulations.v2` model currently stores complete snapshots and separates
selected edit slot from playback/trigger state. Before porting, an ADR must reconcile
that implementation with the accepted sparse-inheritance product model and remove
global rack state from articulation ownership.

Current status: **PARTIAL visually; NOT PORT-READY architecturally**.

## 12. Audition Component

- Audition is a persistent product component, not an ad-hoc button on selected
  screens. Its usefulness in every editing context is a major success criterion.
  `[U40]`
- It includes current articulation, note choice, Trigger/retrigger, Repeat, Latch,
  Capture Motion, and buffer/capture status. `[U01] [U40]`
- Trigger must support repeated manual use while a parameter is being adjusted.
- Repeat automates retriggering for envelope and iterative sound design.
- Latch holds the current note/articulation as needed.
- The accepted Ulm direction treats this as an anchored transport footer: stable
  articulation, note, and Trigger get the clearest hierarchy; Repeat, Latch, Capture,
  and status remain quieter but reachable. `[U68] [U69]`
- The smallest final iPhone form and whether a compact keyboard is also needed remain
  open. Hijacking iOS hardware volume buttons was only a brainstorm and requires
  feasibility work. `[U01]`

## 13. Retrospective Motion Capture

### 13.1 Decided behavior

- The system continuously retains recent manual parameter motion so Capture is
  retrospective rather than armed before performance. `[U01]`
- The designer can repeatedly press/hold a note or on-screen Trigger, move a
  parameter, try again, then press Capture after the take they like. `[U01]`
- Capture belongs to the parameter that was physically moved while the MIDI note or
  on-screen Trigger was held—not the parameter selected later when Capture is
  pressed. `[U62]`
- The candidate retains target identity, edit layer (patch base or articulation
  override), articulation identity, note/Trigger lifecycle, timing, and motion
  samples.
- Before committing, the UI identifies what will be captured, e.g. articulation +
  Wavetable Warp override. `[U62]`
- Commit converts the performed motion into an MSEG already mapped to that target.
  `[U01]`
- Successful capture should have haptic confirmation. `[U62]`

### 13.2 Still open

- Whether motion after note-off becomes an MSEG release phase.
- Exact buffer boundary after note-off and before the next note-on.
- What happens if multiple parameters are moved during one held note.
- External MIDI/MPE note ownership and overlap behavior.
- Simplification, quantization, or smoothing used when converting samples to MSEG.
- Whether a captured MSEG consumes the next progressive MSEG slot automatically or
  offers a replacement choice when capacity is full.

Current status: **PARTIAL semantic mock only**. The prototype remembers a candidate
target but does not record a real sampled motion buffer.

## 14. Global Effects Rack Architecture

### 14.1 Signal path

- MIDI/MPE/articulation metadata input remains first, followed by voice allocation.
- Each allocated note owns a wavetable voice with up to 18 unison subvoices,
  wavetable scan/warp, per-voice multimode filter, fixed ASR, and pan.
- Voices sum before the global rack.
- The old fixed global Distortion → Chorus/Bloom chain is replaced by one global
  reorderable creative effects rack, then output. `[U03] [U04]`

### 14.2 V1 inventory and identity

- V1 has exactly one stable named instance of each module: Global Filter,
  Distortion, OTT, Chorus/Bloom, Flanger, Phaser, Delay, and Reverb. `[U06] [U14]
  [U15]`
- Flanger and Phaser are separate modules. `[U14] [U15]`
- Generic slots, arbitrary duplicates, and runtime processor creation are out of
  scope for v1. `[U06]`
- Effect identity is independent of rack position. Parameters, automation, and
  mappings target effect ID + parameter ID, never numeric position. `[U04-U06]`
- The Cmajor graph uses a fixed resident processor shape and runtime-selected serial
  order; it does not dynamically rewire the graph.

### 14.3 Patch ownership and automation

- Rack order, enabled state, and effect base settings belong to the patch/preset.
  `[U12]`
- Rack order and enabled state are not host-automatable in v1. `[U16]`
- Continuous effect parameters, including Mix/Wet, are host-automatable and
  modulatable. Mix/Wet is the continuous bypass-like automation path. `[U16] [U23]`
- One committed reorder is one undoable action; one enabled-state change is one
  undoable action.
- Stable automation identities survive reorder.

### 14.4 Reorder transition

- Reorder preserves every effect instance and its internal state/tails. `[U05]
  [U11]`
- Preferred transition, only if rack-local and simple: fade output to silence over
  roughly 2–5 ms, atomically replace the order, then fade back in over 2–5 ms.
  `[U11]`
- No duplicated A/B rack, state copying, dynamic allocation, effect-specific
  transition system, or runtime graph rewiring. `[U11]`
- If that bounded transition is not simple and reliable, use a hard atomic order
  swap instead. Complexity is not justified merely to hide a reorder click. `[U11]`
- Existing tails continue through the new downstream order; they are not cleared.

### 14.5 Bypass and CPU

- Disabled means clean hard audible bypass; no wet output and no promise of tail
  spill while disabled. `[U13]`
- A disabled effect may sleep/reset only when that optimization is small and local to
  the effect. Otherwise it can continue advancing silently. `[U13]`
- Do not add rack-wide state traversal, tail detection, background spill routing, or
  duplicate processors to save bypassed CPU. `[U13] [U16]`
- Enabled state is therefore patch/UI state rather than automation. `[U16]`

### 14.6 Latency

- The creative rack declares zero added processing latency. `[U17] [U18]`
- Rack OTT removes the standalone OTT's 3 ms lookahead path; the standalone effect
  may keep it. `[U18]`
- Delay and Reverb retain zero-latency dry paths. Any future lookahead/true-peak
  limiter requires a separate decision outside the creative rack.

### 14.7 Disabled modules and strip behavior

- Rack order is a complete permutation of all eight modules. Disabled modules remain
  visible in their saved position and can be reordered. `[U19]`
- Re-enabling restores the module at the same position.
- Each rack item has one dedicated drag handle, visually distinct from its parameter
  control. Dragging the quick control must not reorder the effect. `[U63]`
- Remove useless ordinal prefixes such as `1.`; order is communicated spatially.
  `[U60]`
- The rack is one continuous surface; selected effect uses strong black/white
  inversion rather than becoming one more independently styled card. `[U67]
  [U71]`

Current DSP status: architectural decisions are accepted in ADR-001 through
ADR-009, but the production rack is not implemented by this UI prototype.

## 15. Effect Strip Quick Controls

- The effects strip remains visible while an effect is focused and horizontally
  scrolls rather than compressing modules below usable touch size. `[U02] [U23]`
- Every effect item always carries one quick continuous parameter. `[U24]`
- Before deliberate edits, each effect supplies a curated default quick parameter.
  `[U25]`
- A deliberate edit in the full effect editor makes that parameter the strip's quick
  control. Editing the strip keeps the same quick parameter selected. `[U24] [U25]`
- Host automation, modulation, preset restore, telemetry, and incoming MIDI do not
  change which quick parameter is shown. `[U25]`
- The remembered quick-parameter ID is UI-session memory, not patch state; loading a
  patch resets to the curated default. `[U25]`
- The strip shows and directly edits the base value, with modulation shown as a
  graphical overlay if useful. `[U24]`
- Strip controls use the same black-and-white wire control language as the parameter
  matrix and relationship controls. The blue native-looking sliders were rejected.
  `[U63]`
- The quick control participates in the global transient HUD contract. `[U60]`

Current status: **PARTIAL/FAIL visually**. Quick-parameter tracking is modeled, but
the current rack composition, rule ownership, spacing, and controls were explicitly
rejected. `[U71] [U75-U78]`

## 16. Macro Decisions

- V1 reserves exactly four Macro slots. `[U20] [U21]`
- A new patch shows Macro 1 and Add; more appear only when the user creates them.
  `[U21]`
- Each macro is patch-global, normalized 0–1, renameable in Cosimo, stored in the
  patch, host-automatable, and can modulate multiple continuous voice/effect
  parameters.
- Macro identity remains stable across rename and reorder.
- Macros are sources, not destinations, in v1. Macro-to-macro routing and cycle
  handling are deferred.

## 17. Graphic-Led Module Editors

- The primary visualization takes center stage and is functionally integrated with
  the controls. `[U02]`
- Wavetable: large waveform/table graphic; scan/index, warp, unison/voicing, tuning,
  and related controls organized around/in it. `[U02]`
- Filter: frequency response plus spectrum; cutoff, resonance, drive, and deeper
  settings remain usable. `[U02] [U31]`
- Phaser/Flanger: line-art response or motion visualization with direct axes and
  persistent timing mode. `[U42] [U59] [U60]`
- Reverb/Delay/Drive/OTT/Chorus: effect-specific visualizations rather than generic
  placeholder panels. `[U02] [U59]`
- Envelope/MSEG: the shape itself is the editor; compact target relationships remain
  available without displacing it. `[U02] [U63]`
- Module-specific graphics may expose multiple axes; do not standardize every module
  into a knob grid merely for component convenience. `[U42]`

The exact control inventory and graphic bindings for every real production module
remain to be grounded in Cosimo's actual endpoints before porting.

## 18. Accepted Visual Direction

### 18.1 Direction, not a decorative skin

- Keep the prototype's largely monochrome black-outline wireframe character. `[U46]
  [U63]`
- The selected generated direction is **Ulm Scientific Instrument**. `[U67]`
- The desired shift is from dozens of independent cards/widgets to a small number of
  coherent instrument surfaces: rack, editor, relationship band, source legend, and
  audition transport. `[U67-U69]`
- The reference is a quality and design-system target, not a demand for literal
  pixel cloning. The final interface must nevertheless reach production polish.
  `[U72]`

### 18.2 Parameter matrix

- Parameters form one shared calibrated matrix rather than six independent cards.
  `[U68]`
- Internal dividing lines may be removed entirely when typography, alignment,
  whitespace, and optical rhythm define the cells. `[U68]`
- Touch targets remain large even when their boxes are visually invisible.
- Labels are compact/condensed; values use tabular treatment; tracks and handles are
  consistent.

### 18.3 Relationship band

- The selected parameter's mappings form one coherent ruled band, not a title row,
  separate Add row, chip cards, and another unrelated panel. `[U58] [U59] [U68]`
- The stable detail surface is part of this band and never inserts itself after a
  tap. `[U74]`

### 18.4 Source legend and audition transport

- The shelf behaves like a compact graph legend: small semantic glyph, slot, target
  count, and a restrained underline/rail. `[U69]`
- Audition behaves like an anchored transport rather than another bordered card.
  `[U69]`

### 18.5 Selection, rules, and typography

- Major discrete selection uses black/white inversion: selected workspace, selected
  effect, selected Free/Sync state, selected mapping, current articulation, and
  active Trigger/Capture where appropriate. `[U67]`
- There is one small rule hierarchy: strong structural boundary, ordinary region
  rule, quiet internal calibration rule, and optional hairline/grid. Random border
  weights are invalid. `[U75] [U76]`
- Spacing, control heights, label lines, value widths, and touch targets come from a
  small token system; they are not patched case by case. `[U75] [U76]`
- The chosen implementation direction uses a condensed engineered sans plus a mono
  numeric/status face, but exact production fonts remain subject to iOS licensing,
  legibility, and bundle decisions.

### 18.6 Semantic color

- Color is reserved for modulation-source and articulation identity, not decorative
  panel chrome. `[U63]`
- Each active source and articulation has a unique color used consistently wherever
  that identity appears: tiny glyph, short rail/range, underline, count mark, or
  sparse override marker. `[U63]`
- Palette references: Native Instruments Super 8 landing page, vintage Kodak, and
  Drum Butter; additions should stay muted/analog rather than generic saturated app
  colors. `[U63]`
- The first translation of this palette into broad colored outlines/cards was
  rejected. The semantic-color principle remains accepted; that execution does not.
  `[U64]`

Current visual status: **FAIL**. The current prototype has not met the accepted Ulm
quality bar and still contains inconsistent borders, spacing, padding, overlaps,
and unstable values. `[U71] [U75-U78]`

## 19. Production-Quality Engineering Rules

- Design the component grammar bottom-up before polishing individual screens.
  `[U76]`
- One component owns each border, padding contract, intrinsic size, and state
  transition. No stylesheet accumulation that requires exceptions to repair other
  exceptions. `[U75] [U76]`
- Use a small spacing/type/rule/control token system and shared primitives. `[U76]`
- Reserve width for all formatted values and stress-test maximum strings. `[U75]`
- No structural absolute positioning. Absolute positioning is limited to handles,
  ticks, graph markers, HUD overlays, and similarly bounded layers. `[U75] [U76]`
- No user-visible overlap, clipping, doubled border, accidental scroll, or dynamic
  layout shift at supported iPhone viewports. `[U75]`
- Preserve interaction behavior while changing visual structure; a refactor that
  removes X/Y control gestures or chip dragging is a regression. `[U79]`
- Verify at least 390×844 and 375×667, including dense mappings, long labels, maximum
  numeric formats, disabled modules, orphan sources, and non-Default articulation.
- Use same-size reference/implementation comparisons and interaction tests; a
  screenshot by itself is not QA.
- Do not report “polished,” “passed,” or “ready” while user-visible defects or
  rejected interactions remain. `[U70-U72] [U78]`
- Major visual passes need a rollback commit first when requested. `[U68]`
- Independent visual, interaction, and responsive/adversarial reviews are part of
  convergence, but the primary agent owns reconciliation and final quality. `[U61]
  [U72]`

## 20. Explicit Rejections And Supersessions

These are not available design options unless the user reopens them:

1. **Mapping drawer over the module** — rejected because it blocks parameters.
   `[U31]`
2. **Separate “Cutoff Modulation” navigation/list step** — rejected; existing
   mappings belong inline. `[U31]`
3. **MSEG replacing Filter while Filter is being edited** — rejected. `[U29]`
4. **Parameter-first versus source-first as competing alternatives** — rejected;
   both flows exist and have explicit focus semantics. `[U29]`
5. **Hidden detail panel inserted after mapping-chip tap** — superseded by a stable
   fixed relationship surface. `[U74]`
6. **Permanent larger duplicate scalar slider after parameter tap** — rejected.
   `[U53-U55]`
7. **Generic effect slots or duplicate instances in v1** — rejected. `[U06]`
8. **Separate LFO family** — rejected; use MSEG. `[U22]`
9. **Reducers beyond Mean and Maximum without a concrete need** — rejected for v1.
   `[U10]`
10. **Rack-order or enabled-state automation in v1** — rejected/compromised out.
    `[U16]`
11. **Workspace dropdown** — rejected in favor of carousel. `[U58]`
12. **Prototype instruction labels** — rejected. `[U58]`
13. **Rack ordinal numbers** — rejected. `[U60]`
14. **`Expand` button without a distinct deeper capability** — rejected until a
    real use case exists. `[U59]`
15. **Reordering source chips** — not desired; stable source slots remain. `[U62]`
16. **Blanket conventional alternate controls for custom gestures** — rejected.
    `[U62]`
17. **Broad decorative source/articulation colors** — rejected execution; keep color
    sparse and semantic. `[U64]`
18. **Blue/native-looking rack sliders outside the wire control language** —
    rejected. `[U63]`
19. **Ad-hoc stylesheet patching and inconsistent component geometry** — rejected as
    a process. `[U75] [U76]`
20. **Visual refactors that remove direct manipulation** — rejected as regressions.
    `[U79]`

## 21. Genuinely Open Product Questions

The session did not settle these:

1. Complete top-level workspace inventory beyond Voice and Effects.
2. Home/overview, patch browser, save/name, menu, settings, and performance/patch
   management flows.
3. Exact articulation management surface for naming, ordering, trigger modes, and
   bank operations.
4. Reconciliation of sparse articulation overrides with production
   `articulations.v2` snapshots and separate edit/playback articulation state.
5. Exact primary/context ratio for every module; two-thirds/one-third is a guiding
   hierarchy, not a universal fixed grid.
6. Which parameters are visually primary versus secondary for each real module.
7. Knob, track, number, or graphic treatment per parameter type.
8. Which genuinely compound editors earn an explicit larger contextual takeover.
9. Smallest useful audition control and whether any compact keyboard is persistent.
10. Feasibility and desirability of iOS hardware volume-button note triggering.
11. Retrospective capture release-phase/post-note semantics.
12. Multiple moved parameters during one capture take.
13. Physical-device gesture thresholds, axis lock, haptic vocabulary, and VoiceOver
    behavior.
14. Production MSEG A/B/Morph editing on mobile.
15. Typed production descriptor mapping from UI identities to real Cmajor endpoints.
16. Exact final font files and expanded semantic palette.

## 22. Current Prototype Compliance Snapshot

This snapshot does not redefine the product contract.

| Area | Status | Evidence / discrepancy |
|---|---|---|
| React component model | PASS directionally | `CosimoMobileExperience` composes feature components behind a mock adapter. |
| Voice/Effects workspace switcher | PASS directionally | Sibling workspaces and centered icon carousel exist. |
| Persistent shell regions | PARTIAL | Header, rack, source shelf, and audition are stable, but content region transitions still violate the no-shift contract. |
| Parameter X/Y direct manipulation | FAIL as experienced | Handlers exist in code, but the current visible design obscures/regresses the accepted interaction and presents sliders as the dominant control. |
| Mapping chip Y-drag | FAIL as experienced | A handler exists, but the user reports it was effectively replaced by slider-centric behavior. |
| Mapping detail geometry | FAIL | Mapping selection enters `MappingFocusEditor`, replacing the module and producing the rejected layout/focus change. |
| Base + modulation + articulation layers | PARTIAL | Effective value, factory-default tick, mapping range, and articulation identity exist, but an overridden control does not currently render the accepted inherited patch-base marker. |
| Source-first target rows | PARTIAL | Direct X/Y rows and open-target actions exist; dense-state layout and production data fidelity are not accepted. |
| Source drag-to-target | PARTIAL | Basic drag targeting exists; dropping onto an already-related target is rejected rather than focusing the existing mapping, and physical-device behavior is unverified. |
| Articulation override UI | PARTIAL | Sparse markers/reset are represented, but production data architecture conflicts remain. |
| Audition/capture | PARTIAL | Persistent controls and semantic target ownership exist; Repeat only changes state text, and actual retrigger scheduling and sample capture do not exist. |
| Effects rack UX | FAIL | User rejected the current card composition, spacing, borders, values, and polish. |
| Rack enable/reorder undo | NOT PROTOTYPED | The accepted one-command Undo boundaries do not exist in the mock adapter. |
| Ulm visual system | FAIL | The selected direction is not yet faithfully or consistently implemented. |
| Responsive stability | FAIL pending proof | User observed overlap and layout shifts; no accepted same-state reference comparison exists. |
| Velocity / Pressure / Slide | PARTIAL | Pressure exists in the fixture; Velocity and Slide are absent and fixed expressive sources are not available through Add Source. |
| Renameable macros | NOT PROTOTYPED | Macro slots exist, but no rename command or UI exists. |
| Production parameter fidelity | NOT PROTOTYPED | Effect/voice descriptors remain illustrative and differ from real endpoints. |

### 22.1 Production-model conflicts discovered during the ledger audit

These findings do not overturn the product decisions; they identify work required
before the React prototype can be connected to the real synth:

- `ui/shared/articulations.ts` currently persists complete `articulations.v2`
  snapshots, supports up to 128 dynamic articulation slots, and separates trigger
  modes (`chain`, `key`, `vel`). It also still snapshots Distortion and Chorus state,
  contradicting both sparse inheritance and patch-owned global rack state.
- `ui/shared/modulation.ts` stores each MSEG as Shape A, Shape B, Morph, and Playback.
  The prototype's simple shape plus Time/Scale/Curve is not a production-faithful
  MSEG editor.
- The production modulation model already exposes Velocity, Pressure, and Slide,
  but has no active/visible-slot state for the progressive `1 + Add` source shelf.
- Macros are accepted product scope but are not yet represented in the real
  modulation schema/DSP.
- Prototype effect descriptors are illustrative. A typed descriptor layer must map
  stable UI parameter identities to real endpoints, ranges, formats, defaults,
  automatable/modulatable flags, curated quick controls, and graphic bindings.
- `CosimoMobileAdapter` currently types patch and audition snapshots as opaque
  objects and omits patch metadata, articulation-bank state, edit-versus-playback
  articulation state, active source slots, real capture samples, and production
  descriptors.
- The current capture reducer stores only target/layer/articulation metadata and
  creates a default MSEG mapping. It does not retain motion samples, note timing, or
  MIDI note lifecycle.

### 22.2 Repository safety finding

The componentized React refactor is currently largely untracked in Git. The latest
commits do not provide a complete rollback point for the current feature tree,
controller, adapter, domain, interaction, CSS, and test files. Before any further
prototype refactor, preserve the current state in an intentional checkpoint so a
visual or interaction pass cannot silently discard working behavior again.

### 22.3 Existing-document conflicts

Until those files are reconciled, this later transcript ledger takes precedence:

- `COSIMO_MOBILE_SOUND_DESIGN_UI_CONSTRAINTS.md` still lists the mapping
  representation as open and describes a chip expanding an inline card. The later
  decision is a permanently allocated relationship surface whose selected content
  swaps without insertion or collapse. `[U74]`
- `INTERACTION_MATRIX.md` and prototype `AGENTS.md` currently say a routine mapping
  chip tap replaces the fixed workspace and collapses the primary module to a live
  target strip. That is the stale behavior the user rejected. A deep contextual
  takeover remains possible only through a distinct, explicit deep-edit action—not
  the ordinary mapping-chip tap.
- The constraints document still treats top-level navigation method as broadly open.
  Voice and Effects now have an accepted carousel interaction; only the additional
  workspace inventory remains open. `[U49] [U58]`

## 23. Frameworks Used In The Discussion

- **Grill With Docs** was explicitly invoked for the reorderable rack. It produced
  the accepted ADR sequence for rack identity, reducers, transitions, state,
  bypass, inventory, automation, latency, disabled modules, macros, progressive
  disclosure, destinations, and strip quick controls. `[U05-U25]`
- **Wayfinder** was explicitly requested to establish the destination for the whole
  iOS experience and avoid prematurely optimizing an Effects screen. `[U32-U38]`
- **HTML/React interaction prototypes** were requested to settle spatial and gesture
  questions through realistic interaction rather than verbal alternatives. `[U26]
  [U27] [U46] [U48]`
- **Adversarial UX panel review** was requested as a read-only critique before more
  edits. `[U61]`
- **Image-based style exploration** was requested only after structural interaction
  prototyping, leading to selection of Ulm Scientific Instrument. `[U64-U67]`

## Appendix A — Complete User-Message Trace

Every user message in the stored session is accounted for below. “Outcome” records
whether it created a decision, clarified a prior one, requested a process step, or
left a question open.

| Ref | User contribution | Outcome |
|---|---|---|
| U01 | Initial stream of consciousness: sound-design-first mobile loop, retrigger while editing, dual parameter/source access, retrospective motion capture, possible keyboard/hardware trigger. | Established foundational loop and capture goal; release behavior and trigger hardware left open. |
| U02 | Required graphic/visual dominance; explored tabs, chain, accordion/gallery, articulations, focused voice/effect, compact filter/drive, source chips. Warned not to turn uncertainty into assumptions. | Established graphic-led principle and uncertainty discipline; navigation inventory remained open. |
| U03 | Asked for current Cosimo architecture inventory as a mutable baseline. | Process request; architecture was inspected, not frozen. |
| U04 | Confirmed MIDI/MPE input, allocator, per-note wavetable voice, and voice sum; proposed replacing fixed global Distortion/Chorus with global effects chain; requested deep reorder feasibility. | Set intended signal-path change and feasibility scope. |
| U05 | Invoked Grill With Docs for complete reorderable-rack clarity, including MPE and reorder transition behavior. | Established ADR/interview framework. |
| U06 | Accepted fixed named-module inventory for v1. | Rejected generic slots/duplicates for v1. |
| U07 | Asked whether reducer algorithm should be fixed or selectable and named max versus average. | Led to per-mapping closed reducer choice. |
| U08 | Requested catch-up after several days and asked which framework was guiding the work. | Process/continuity request. |
| U09 | Declared reducer concept satisfactory and asked to continue. | Accepted explicit voice-to-global reducer model. |
| U10 | Stopped reducer overthinking; selected Mean and Max. | Closed v1 reducer inventory. |
| U11 | Accepted reorder transition only if it did not introduce much complexity. | Accepted bounded fade/swap/fade with hard-swap fallback. |
| U12 | Put rack order, enabled modules, and base settings in patch state. | Accepted state ownership. |
| U13 | Accepted bypass/CPU approach only if low-complexity. | Accepted hard audible bypass with optional local sleep only. |
| U14 | Required repository OTT, another/global filter, and Flange/Phaser. | Expanded v1 rack inventory. |
| U15 | Accepted Flanger and Phaser as separate named modules. | Closed module separation. |
| U16 | Accepted automation proposal; explicitly allowed enabled automation to be dropped for CPU/complexity. | Rack order/enabled not automatable; continuous Mix/parameters are. |
| U17 | Asked what Serum does regarding rack/latency precedent. | Research prompt informing zero-latency decision. |
| U18 | Accepted the resulting low/zero-latency direction. | Rack OTT drops lookahead; creative rack zero declared latency. |
| U19 | Accepted keeping disabled modules in rack order/visibility. | Complete permutation with dimmed disabled modules. |
| U20 | Required Serum-style macros. | Added patch-global macro system. |
| U21 | Selected four macros and `one + Add` progressive disclosure; extended same UX to Envelope/MSEG. | Accepted capacities and progressive visibility. |
| U22 | Corrected “LFO” to MSEG and prohibited an extra LFO family. | No separate LFO. |
| U23 | Accepted continuous-only modulation destinations and focused editor + strip direction. | Closed destination eligibility and workspace premise. |
| U24 | Required each effect strip item to keep the last tweaked parameter available. | Established quick-parameter behavior. |
| U25 | Accepted curated default and transient UI-memory treatment. | Quick-parameter ID not patch state. |
| U26 | Said verbal choice was impossible without a visual prototype. | Required visual/interactive evidence. |
| U27 | Rejected a non-question and requested HTML prototypes demonstrating proposed flows. | Moved discussion to prototypes. |
| U28 | Rejected unexplained alternatives. | Required differences/tradeoffs to be explicit. |
| U29 | Corrected the core model: parameter-first and source-first are separate flows; source never replaces Filter during Filter editing. | Established explicit stable-focus invariant. |
| U30 | Rejected the drift and asked for an actionable next step. | Triggered reset toward constraints/prototype. |
| U31 | Rejected mapping drawer, separate Cutoff Modulation action, missing retrigger, and navigation between cutoff base and mapping amount; suggested inline rows or chips plus one card. | Established inline/co-editable mapping invariant and rejected drawer. |
| U32 | Requested Matt Pocock's Wayfinder skill and transitive dependencies, then immediate Wayfinder process. | Established whole-product destination framework. |
| U33 | Clarified scope is the whole core mobile experience, not Effects; “sound-design workspace” may describe the whole app. | Broadened destination. |
| U34 | Required explicit satisfaction of the mobile UI constraints document in the destination. | Added acceptance criterion. |
| U35 | Scoped destination specifically to iOS. | Platform scope closed. |
| U36 | Authorized beginning the Wayfinder process. | Process continuation. |
| U37 | Confirmed the proposed destination gist. | Accepted whole-iOS sound-design destination. |
| U38 | Confirmed the next contextual premise. | Accepted patch-centered working context. |
| U39 | Asked how articulation switching fits and explored relative versus absolute overrides. | Opened articulation model decision. |
| U40 | Selected sparse absolute overrides; required persistent identification/reset; endorsed current articulation beside audition. | Closed core articulation UX/model. |
| U41 | Asked for alternatives to the proposed page composition. | Prompted explicit layout comparison. |
| U42 | Selected roughly 2/3 primary + 1/3 contextual secondary after persistent controls; required graphic direct manipulation; noted full MSEG cannot fit in bottom third. | Established spatial hierarchy and deep-editor need. |
| U43 | Warned against over-indexing on last-touched parameter; accepted contextual expansion concept; required reduced numerical overload and contextual finger-safe value popup. | Refined secondary region and value-HUD direction. |
| U44 | Kept numbers available based on space; declined commitment to knobs; proposed stronger controls for primary parameters and compact treatment for secondary ones. | Prevented an over-broad no-number/no-knob rule. |
| U45 | Identified the three-layer display problem: base, MSEG amount, articulation override. | Established layered visual-information requirement. |
| U46 | Confirmed non-Default manipulation edits/creates override; requested realistic Phaser phone prototype after persistent-control inventory; specified plain outline wireframe and no ImageGen. | Closed edit-layer behavior and prototype brief. |
| U47 | Asked for a user-friendly distinction between contextual secondary and modulator access. | Clarified relationship inspector versus persistent source shelf roles. |
| U48 | Chose immediate plain HTML wireframe. | Authorized prototype implementation. |
| U49 | Asked how to reach oscillator view and requested suggestions without edits. | Exposed missing top-level workspace navigation. |
| U50 | Asked for flow walkthrough; proposed direct X/Y parameter tiles, default tick/mod range, source icons, editable target rows, realistic per-source targets, contextual return label. | Established compact-control gesture and source-flow fidelity. |
| U51 | Reiterated editable source target rows, source icons, and X-base/Y-selected-mapping parameter tiles. | Reinforced direct-manipulation contract. |
| U52 | Asked what “same compact control in module and target list” meant. | Required concrete component example. |
| U53 | Asked what opening a wider version of a compact scalar would add beyond a slider. | Challenged expansion pattern. |
| U54 | Narrowed the question specifically to parameter buttons and summarized current tap effects. | Prevented irrelevant source-editor discussion. |
| U55 | Asked about the eventual product, not prototype limitations, and demanded hypothetical parameter-type analysis. | Led to scalar-no-expansion/compound-exception decision. |
| U56 | Authorized addressing all concerns accumulated since the last edit. | Implementation step. |
| U57 | Reported prototype was not loading. | Operational defect; server restored. |
| U58 | Removed explanatory titles, merged mapping header/Add row, and replaced workspace dropdown with center-weighted swipeable carousel. | Closed several IA/chrome decisions. |
| U59 | Required amount-bearing vertically draggable mapping chips, removal of wasted headings, justification/removal of Expand, real line art, and source-preview navigation. | Closed relationship-band interaction direction. |
| U60 | Required open-target action, persistent Free/Sync without shifts, last-touched rack quick control, no ordinal, long-press source deletion, and universal continuous-value HUD. | Added navigation, management, and global HUD contracts. |
| U61 | Requested read-only adversarial UX subagent panel. | Established independent review step. |
| U62 | Confirmed source-target return trail, clarified capture ownership, strongly accepted haptics, rejected blanket conventional alternatives, scoped reducer, rejected source-chip reorder, required orphan/count state and drag-to-target affordance. | Closed many interaction details; left exact articulation marker presentation for next message. |
| U63 | Required monochrome wireframe plus unique semantic colors/icons for mappings/articulations, accepted compact progressive relationship treatment, demanded better primary-space use, rack drag handles, and shared wire sliders. | Closed semantic color/icon and rack-control direction. |
| U64 | Declared current design unattractive; kept wireframe aesthetic but rejected color translation; requested UX/style ideation without edits. | Rejected implementation, not semantic-color principle. |
| U65 | Asked for precise difference between generated style directions. | Required design-language explanation. |
| U66 | Asked to regenerate with more exaggerated differentiation. | Increased style-exploration contrast. |
| U67 | Selected option 3, Ulm Scientific Instrument, and asked for exact required changes. | Chose visual direction and black/white inverse selection. |
| U68 | Brought in UI Design Overhaul discussion; selected shared borderless parameter matrix and single mapping band first; requested rollback commit. | Accepted Ulm structural primitives 1 and 2. |
| U69 | Asked to continue after first two. | Extended direction to source legend and audition transport. |
| U70 | Asked whether a real audit had identified remaining work. | Required evidence-based completion tracking. |
| U71 | Rejected effect rack/card result as visibly incorrect. | Marked rack visual implementation FAIL. |
| U72 | Required product-manager-at-Figma quality, autonomous rough-edge finding, and subagent-led execution. | Raised acceptance bar and process requirements. |
| U73 | Reported dev server stopped. | Operational defect; service continuity requirement. |
| U74 | Rejected mapping chip revealing a hidden panel and causing a large layout shift. | Superseded earlier chip-expansion interpretation with fixed stable surface. |
| U75 | Enumerated visual failures: inconsistent padding/borders/spacing, overlaps, and values causing shifts; asked how process would converge. | Established geometry-first convergence requirements. |
| U76 | Rejected ad-hoc stylesheet patching and demanded bottom-up design-system/component principles for production quality. | Established token/component ownership process. |
| U77 | Clarified this will port into the real React/Cosimo iOS product and demanded clean component architecture now. | Established React/adapter port direction. |
| U78 | Rejected the latest visual result again. | Current visual implementation remains FAIL. |
| U79 | Reported lost chip/parameter X/Y interactions and demanded every prior decision/invariant be restored. | Marked interaction refactor as regression and triggered ledger. |
| U80 | Demanded a complete line-by-line inventory of every session decision. | This document. |

## Appendix B — Canonical Accepted Rack Documents

The following ADRs are subordinate to later direct user corrections but remain the
canonical detailed rack decisions:

- ADR-001 Reorderable Global Effects Rack
- ADR-002 Global Effects Modulation Domain
- ADR-003 Effects Rack Reorder Transition
- ADR-004 Effects Rack State Ownership
- ADR-005 Effects Rack Bypass
- ADR-006 Effects Rack V1 Inventory
- ADR-007 Effects Rack Host Automation And Undo
- ADR-008 Effects Rack Latency
- ADR-009 Disabled Modules Retain Rack Position
- ADR-010 Patch Macro Controls
- ADR-011 Progressive Modulator Disclosure
- ADR-012 Effects Rack Modulation Destinations
- ADR-013 Effects Workspace And Strip Quick Controls
