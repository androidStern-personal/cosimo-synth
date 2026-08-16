# Cosimo Mobile Sound-Design UI Constraints

Status: conversation-derived source of truth. This document separates settled
constraints from working directions and open questions; it does not convert
brainstorming into decisions.

## Product Goal

Cosimo's mobile interface has distinct **Sound Design** and **Performance** modes.
Sound Design mode is optimized around this core loop:

1. Trigger or retrigger a note or articulation.
2. Adjust a base parameter.
3. Adjust how modulation affects that parameter.
4. Hear the result immediately and repeat without changing screens.

The UI succeeds when that loop feels faster on a phone than navigating a
conventional desktop synth reduced to tabs.

## Workspace Modes

This is a settled product distinction:

- **Sound Design mode:** the bottom panel shows a single trigger button. This keeps
  auditioning immediately available while conserving screen space for the focused
  editor, base controls, and modulation relationships.
- **Performance mode:** the bottom panel changes to a more involved play surface.
  Its exact controls and interaction design are not yet settled.

The major visible difference between the two modes is the bottom panel. This
decision does not yet specify whether other parts of the workspace also differ or
exactly how switching modes preserves editing context.

## Non-Negotiable Interaction Invariants

### 1. Focus changes only through explicit selection

The selected oscillator, effect, filter, envelope, or MSEG owns the focused editor
until the user explicitly selects something else.

- Opening a Filter parameter's modulation controls must not replace the Filter with
  an MSEG editor.
- Editing a mapping from MSEG 1 to Filter Cutoff must not implicitly change focus
  in either direction.
- Selecting MSEG 1 itself is a separate action and a separate flow; only then does
  the MSEG become the focused editor.

Parameter-focused and source-focused editing are complementary flows, not
alternative layouts for the same screen.

### 2. The focused editor remains visible and operable

Its primary visualization takes center stage, with its controls integrated around
or into the graphic. Parameter mappings do not live in a drawer or modal. Mapping
UI must not obscure or disable the base parameters the user is shaping.

For a focused Filter, the user must be able to see the response/spectrum graphic
and adjust base Cutoff while also adjusting Cutoff's modulation amount. The same
principle applies to oscillator index/warp, envelopes, effects, and other focused
modules.

### 3. Auditioning remains available during sound design

Every focused sound-design view needs a reachable way to hear the current result.
The user must be able to repeatedly retrigger a note while adjusting an envelope,
Filter Cutoff, modulation amount, effect parameter, or captured gesture.

In Sound Design mode, this requirement is met by the bottom panel's single trigger
button rather than a larger performance surface.

The eventual audition surface must also account for named articulations and
articulation latching/switching. A view that contains the editor but no practical
note trigger is incomplete.

### 4. Base value and modulation relationship are co-editable

The ordinary parameter-editing loop cannot require navigation between:

- the parameter's unmodulated/base value;
- the amount and polarity of each mapping;
- the voice-to-global reducer when applicable;
- note retriggering.

These controls need to coexist in the current working context.

### 5. Existing mappings are visible without opening a separate list

Current preferred direction:

- Show compact mapping rows directly in the focused module; or
- if full rows consume too much space, show source chips and let one selected chip
  expand a single inline **mapping focus card** below them.

The expanded card edits the relationship, not the source itself. It may show
amount, polarity, reducer, and related mapping settings. It must not replace the
focused module or cover its base controls.

### 6. Mobile density is reduced through progressive disclosure, not hidden DSP

Cmajor may reserve fixed slots, while the UI shows only what the patch uses:

- Macro 1 plus Add Macro, up to four;
- Envelope 1 plus Add Envelope, up to three;
- MSEG 1 plus Add MSEG, up to three;
- no separate LFO family; looping MSEGs cover that use case.

Unused slots must not burden a new patch with inactive controls.

## The Two Modulation Flows

### Focused parameter or module

Example: Global Filter is focused and Cutoff is selected.

The Filter stays central. The interface exposes Cutoff's assigned sources and an
Add Source action. Each assigned source exposes or expands its mapping controls:
amount, polarity, and reducer where required. The user can adjust base Cutoff,
mapping amount, and audition the result without navigation.

This flow answers: **What is moving this parameter, and by how much?**

### Focused modulation source

Example: the user explicitly selects MSEG 1 from the modulator area.

MSEG 1 stays central, with its graphic and source parameters available. Its target
list shows every parameter it controls, with the relationship controls for each
mapping. Editing a target mapping does not replace the MSEG with that target's
module.

This flow answers: **What does this source control, and by how much?**

## Persistent Context Around a Focused Editor

Settled or strongly required context:

- A large graphic-led focused editor.
- A compact ordered effects strip while working in the global effects workspace.
- One quick parameter on each effect strip item: the curated default until the user
  deliberately edits another parameter in that effect, then the last deliberately
  tweaked parameter.
- Discoverable active modulators with progressive Add tiles.
- A practical audition/retrigger and articulation control surface.

The final spatial arrangement is not settled. These elements must not all be made
"persistent" by shrinking them below useful touch size. The design needs to decide
which context is always present, which can compact, and which can scroll without
breaking the core sound-design loop.

## Graphic-Led Module Editors

The visual representation is the module, not decoration behind a generic knob
grid.

- Wavetable voice: the table/waveform graphic dominates; scan, warp, voicing,
  tuning, and related controls are integrated around it.
- Filter: response curve and spectrum dominate; base parameters and mapping state
  remain operable.
- Effects: each effect has an effect-specific primary visualization, with its
  controls organized around that graphic.
- Envelope/MSEG: the shape is the focused editing surface, with its targets
  available without displacing it.

## Audition And Retrospective Gesture Capture

Cosimo should continuously retain recent manual parameter motion so the user can:

1. Trigger a note.
2. Move a parameter while listening.
3. Repeat note-plus-motion attempts rapidly.
4. Press Capture only after performing a take they like.
5. Convert that take into an MSEG already mapped to the moved parameter.

The working capture boundary begins at note-on and retains material until the next
note-on. The exact treatment of note-off, post-note movement, and a possible release
phase remains unresolved.

The capture workflow reinforces the same screen constraint: the moved parameter
and note trigger must coexist.

## Effects Workspace Decisions The UI Must Represent

- The rack is global, after voice summing.
- V1 has one fixed named instance of each module: Global Filter, Distortion, OTT,
  Chorus/Bloom, Flanger, Phaser, Delay, and Reverb.
- The rack contains every module exactly once. Disabled modules stay visible in
  their saved position and can still be reordered.
- Order, enabled state, and base settings belong to the patch.
- Effect identity is stable when reordered; automation and modulation target effect
  and parameter identity, never rack position.
- Rack order and enabled state are not host-automatable in v1. Continuous effect
  parameters, including Mix/Wet, are automatable and modulatable.
- A reorder is one undoable action. An enable change is one undoable action.
- The creative rack has zero declared latency. Rack OTT drops the standalone
  lookahead path.
- Reorder click protection is a short rack-level fade-out, atomic swap, and fade-in
  only if that remains simple; otherwise v1 uses a hard atomic swap.

## Modulation Decisions The UI Must Represent

- Four patch-global, renameable, automatable macros are available progressively.
- MSEG 1-3 and Envelope 1-3 are note-triggered voice-domain sources.
- Velocity, MPE Pressure, and MPE Slide are voice-domain sources.
- Every continuous creative effect parameter can be a destination, including
  Mix/Wet.
- Rack order, enabled state, and discrete effect modes are not modulation targets.
- Voice-domain sources targeting a global effect require a reducer on that mapping.
- V1 reducers are Maximum and Mean; Maximum is the default.
- Reducer choice is an advanced relationship setting, not mandatory friction during
  ordinary assignment.

## Explicitly Rejected Prototype Behaviors

- Replacing a focused Filter with an MSEG merely because a Filter mapping was
  opened.
- Treating parameter-focused and source-focused editing as competing product
  options.
- A parameter-mapping drawer, even if dismissible: it hides mappings until opened
  and competes with the focused editor for the same space.
- A separate "Cutoff Modulation" navigation step when current mappings can be shown
  inline.
- Any focused sound-design view with no usable note retrigger.
- Any flow that forces navigation merely to alternate between a base value and its
  modulation amount.
- Cramming all reserved macros, envelopes, or MSEGs into a new patch.

## Genuinely Open Layout Questions

1. Are parameter mappings best represented as always-visible compact rows, source
   chips plus one expanded inline mapping card, or a responsive combination?
2. How much vertical space belongs to the primary graphic versus base controls,
   mapping controls, the effects strip, modulators, and auditioning?
3. What note, articulation, repeat, or latch behavior does the single Sound Design
   trigger button invoke?
4. How are articulation selection and articulation latch exposed alongside that
   audition surface?
5. Which top-level focus areas exist, and are they reached through tabs, a home
   overview, an accordion-like workspace, direct module strips, or swiping?
6. Which compact controls remain visible when a module is focused beyond the
   effects strip's last-tweaked quick parameter?
7. How should note-off and motion after note-off map into retrospective capture and
   a possible MSEG release phase?
8. What controls and gestures belong in Performance mode's expanded play surface?

Do not prototype another global layout until it can demonstrate the core loop in
one view: **trigger → adjust base value → adjust mapping → retrigger**.
