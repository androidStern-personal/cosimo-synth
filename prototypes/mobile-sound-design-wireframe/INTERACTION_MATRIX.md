# Interaction Contract

This matrix freezes the product behavior while the prototype's React and visual
architecture are rebuilt. Visual refactoring may change component anatomy, but it
must not remove these flows.

| Surface | Intent | Required behavior | Geometry invariant |
| --- | --- | --- | --- |
| Workspace carousel | Move between Voice and Effects | Tap either neighbor or swipe horizontally; restore the last module and parameter in each workspace | Header height and neighboring controls do not move |
| Effect rack | Focus an effect | Tapping the identity opens its editor | Tile width, quick-control lane, enable cell, and reorder cell are stable |
| Effect rack | Adjust a quick value | Scrub the module's last deliberately touched parameter; keep it selected | All formatted values occupy a reserved value column |
| Effect rack | Enable or bypass | Toggle the named effect without removing or moving it | Enabled and bypassed tiles have identical metrics |
| Effect rack | Reorder | Drag only the dedicated reorder handle; preserve effect and mapping identity | Actual handle cell is at least 44px and does not overlap quick adjustment |
| Module graphic | Shape the focused module | Direct manipulation edits the module's named X/Y parameters and updates the transient HUD | Compound controls remain in a reserved overlay lane |
| Parameter matrix | Select and edit | Tap selects; horizontal drag edits the effective base layer; vertical drag edits the selected mapping amount | Every cell has stable tracks, source marks, and value lanes |
| Articulation override | Edit a non-default voice layer | Editing an eligible voice parameter creates/updates an absolute sparse override; Reset removes only that override | Override marks appear without changing cell size |
| Parameter-first modulation | Inspect mappings | Focused module remains visible; the permanent compact band exposes all current sources and amounts | Inspector is permanently allocated and never collapses |
| Mapping chip | Quick-adjust or focus a relationship | Vertical drag adjusts amount; tap swaps the permanently allocated detail to that relationship while the module remains operable | Chip and detail rows are always reserved; no workspace or shell region moves |
| Relationship detail | Edit mapping metadata | Keep amount on the draggable chip; expose polarity, reducer when required, remove, and explicit source navigation | Empty and populated states occupy the same fixed slot |
| Explicit source navigation | Edit a modulation source deeply | Source shelf or relationship-detail source action opens the source editor; returning restores the module and selected target | Navigation replaces only the workspace and preserves shallow return context |
| Source shelf | Focus a source | Tap opens that source editor; icon, slot, orphan state, and attachment count remain visible | Shelf height and chip metrics are fixed |
| Source shelf | Assign by drag | Drag a source; eligible parameters become visible drop targets; drop creates or focuses the mapping | Drag feedback is an overlay and does not reflow controls |
| Source shelf | Add/delete/undo | Reveal reserved Macro/Envelope/MSEG slots progressively; delete clears mappings; Undo restores the exact source when possible | Menus and Undo are overlays outside structural flow |
| Source editor | Edit source and targets | Source graphic remains focused; compact target rows expose relationship values; one row may expose deeper settings inside the target scroll surface | Shell bands remain fixed; target list is a named scroll surface |
| Source-to-target navigation | Open a target and return | Open the target module with that relationship selected; Back restores source, expanded target, and scroll position | Navigation replaces the workspace; it is not an inline expansion |
| Audition transport | Trigger/retrigger | Trigger remains reachable in every focused editor; Repeat and Latch preserve their established behavior | Transport occupies a fixed shell row |
| Retrospective capture | Capture performed motion | While MIDI note or Trigger is held, remember the parameter actually moved and its patch/articulation layer; Capture creates the next available MSEG already mapped to it | Status text is bounded and cannot resize the transport |

## Reducer policy

- Macro to voice/global target: no reducer.
- Per-note Envelope, MSEG, Velocity, Pressure, or Slide to a global effect:
  show Maximum or Mean; Maximum is the default.
- Per-note source to a per-note voice target: no reducer control.

## Capacity policy

- Four Macro slots, three Envelope slots, and three MSEG slots are reserved.
- A new patch exposes only Macro 1, Envelope 1, and MSEG 1 plus Add.
- There is no separate LFO family.

## Layout-state fixtures

The final verification pass must cover:

1. Phaser Frequency with MSEG 1 and Pressure mappings.
2. Phaser Depth with one Macro mapping.
3. An unmapped Phaser parameter.
4. Wavetable with and without a Pluck override.
5. Envelope 1 with multiple targets and Envelope 2 as an orphan.
6. Enabled and bypassed rack effects with short and maximum-length values.
7. Trigger idle, held, repeated, latched, capture-ready, captured, and MSEG-full states.
